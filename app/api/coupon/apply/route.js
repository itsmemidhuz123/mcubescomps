import { NextResponse } from 'next/server';

let adminDb = null;
let FieldValue = null;

async function getAdminDb() {
    if (adminDb) return { db: adminDb, FieldValue };

    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore, FieldValue: FV } = await import('firebase-admin/firestore');

    FieldValue = FV;

    if (!getApps().length) {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;

        if (!projectId || !clientEmail || !privateKey) {
            throw new Error('Missing Firebase Admin credentials');
        }

        privateKey = privateKey.replace(/\\n/g, '\n');

        initializeApp({
            credential: cert({ projectId, clientEmail, privateKey }),
        });
    }

    adminDb = getFirestore();
    return { db: adminDb, FieldValue };
}

export async function POST(request) {
    try {
        const { couponCode, userId, competitionId, originalAmount } = await request.json();

        if (!couponCode || !userId || originalAmount === undefined) {
            return NextResponse.json({
                success: false,
                error: 'Missing required fields'
            }, { status: 400 });
        }

        const { db, FieldValue } = await getAdminDb();

        const result = await db.runTransaction(async (transaction) => {
            const couponQuery = db
                .collection('coupons')
                .where('code', '==', couponCode.toUpperCase())
                .limit(1);

            const couponSnapshot = await transaction.get(couponQuery);

            if (couponSnapshot.empty) {
                throw new Error('Invalid coupon code');
            }

            const couponDoc = couponSnapshot.docs[0];
            const coupon = { id: couponDoc.id, ...couponDoc.data() };

            if (!coupon.active) {
                throw new Error('This coupon has been deactivated');
            }

            if (coupon.expiresAt) {
                const expiryDate = coupon.expiresAt.toDate ? coupon.expiresAt.toDate() : new Date(coupon.expiresAt);
                if (new Date() > expiryDate) {
                    throw new Error('This coupon has expired');
                }
            }

            const currentUsedCount = coupon.usedCount || 0;
            if (coupon.usageLimitTotal && currentUsedCount >= coupon.usageLimitTotal) {
                throw new Error('This coupon has reached its usage limit');
            }

            const userUsageQuery = db
                .collection('couponUsages')
                .where('couponId', '==', coupon.id)
                .where('userId', '==', userId);

            const userUsageSnapshot = await transaction.get(userUsageQuery);
            const userUsageCount = userUsageSnapshot.size;
            const perUserLimit = coupon.usageLimitPerUser || 1;

            if (userUsageCount >= perUserLimit) {
                throw new Error(`You have already used this coupon ${perUserLimit} time(s)`);
            }

            if (coupon.applicableCompetitionIds && coupon.applicableCompetitionIds.length > 0) {
                if (!competitionId || !coupon.applicableCompetitionIds.includes(competitionId)) {
                    throw new Error('This coupon is not valid for this competition');
                }
            }

            if (coupon.newUsersOnly) {
                const userRegsQuery = db
                    .collection('registrations')
                    .where('userId', '==', userId)
                    .limit(1);
                const userRegsSnapshot = await transaction.get(userRegsQuery);

                if (!userRegsSnapshot.empty) {
                    throw new Error('This coupon is only valid for new users');
                }
            }

            let discountAmount = 0;
            let finalAmount = originalAmount;

            switch (coupon.type) {
                case 'full':
                    discountAmount = originalAmount;
                    finalAmount = 0;
                    break;
                case 'flat':
                    discountAmount = Math.min(coupon.value, originalAmount);
                    finalAmount = Math.max(0, originalAmount - coupon.value);
                    break;
                case 'percentage':
                    discountAmount = Math.round(originalAmount * (coupon.value / 100) * 100) / 100;
                    finalAmount = Math.max(0, originalAmount - discountAmount);
                    break;
                default:
                    throw new Error('Invalid coupon type');
            }

            transaction.update(couponDoc.ref, {
                usedCount: FieldValue.increment(1)
            });

            const usageRef = db.collection('couponUsages').doc();
            transaction.set(usageRef, {
                couponId: coupon.id,
                couponCode: coupon.code,
                userId,
                competitionId,
                originalAmount,
                discountAmount,
                finalAmount,
                usedAt: FieldValue.serverTimestamp()
            });

            return {
                coupon: {
                    id: coupon.id,
                    code: coupon.code,
                    type: coupon.type,
                    value: coupon.value,
                },
                originalAmount,
                discountAmount,
                finalAmount
            };
        });

        return NextResponse.json({
            success: true,
            ...result,
            message: result.coupon.type === 'full'
                ? 'Coupon applied - Free entry!'
                : result.coupon.type === 'flat'
                    ? `Coupon applied - ₹${result.coupon.value} off!`
                    : `Coupon applied - ${result.coupon.value}% off!`
        });

    } catch (error) {
        console.error('Coupon apply error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to apply coupon'
        }, { status: 400 });
    }
}