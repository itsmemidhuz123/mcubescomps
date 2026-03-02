import { NextResponse } from 'next/server';

let adminApp = null;
let adminDb = null;

function parsePrivateKey(privateKey) {
    if (!privateKey) return null;

    // If already has actual newlines, return as-is
    if (privateKey.includes('\n') && !privateKey.includes('\\n')) {
        return privateKey;
    }

    // Convert \n string literals to actual newlines
    return privateKey.replace(/\\n/g, '\n');
}

async function initializeAdmin() {
    if (adminDb) return adminDb;

    try {
        const { initializeApp, getApps, cert } = await import('firebase-admin/app');
        const { getFirestore } = await import('firebase-admin/firestore');

        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

        if (!projectId || !clientEmail || !privateKeyRaw) {
            console.error('Missing env vars:', {
                projectId: !!projectId,
                clientEmail: !!clientEmail,
                privateKey: !!privateKeyRaw
            });
            throw new Error('Missing Firebase environment variables');
        }

        const privateKey = parsePrivateKey(privateKeyRaw);

        if (!adminApp) {
            if (getApps().length === 0) {
                adminApp = initializeApp({
                    credential: cert({
                        projectId,
                        clientEmail,
                        privateKey
                    })
                });
            } else {
                adminApp = getApps()[0];
            }
        }

        adminDb = getFirestore(adminApp);
        return adminDb;
    } catch (error) {
        console.error('Firebase Admin initialization error:', error.message);
        throw error;
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { couponCode, userId, competitionId, originalAmount } = body;

        if (!couponCode || !userId || originalAmount === undefined) {
            return NextResponse.json({
                valid: false,
                error: 'Missing required fields'
            }, { status: 400 });
        }

        const db = await initializeAdmin();

        const couponQuery = await db
            .collection('coupons')
            .where('code', '==', couponCode.toUpperCase())
            .limit(1)
            .get();

        if (couponQuery.empty) {
            return NextResponse.json({
                valid: false,
                error: 'Invalid coupon code'
            }, { status: 404 });
        }

        const couponDoc = couponQuery.docs[0];
        const coupon = { id: couponDoc.id, ...couponDoc.data() };

        if (!coupon.active) {
            return NextResponse.json({
                valid: false,
                error: 'This coupon has been deactivated'
            }, { status: 400 });
        }

        if (coupon.expiresAt) {
            const expiryDate = coupon.expiresAt.toDate ? coupon.expiresAt.toDate() : new Date(coupon.expiresAt);
            if (new Date() > expiryDate) {
                return NextResponse.json({
                    valid: false,
                    error: 'This coupon has expired'
                }, { status: 400 });
            }
        }

        if (coupon.usageLimitTotal && coupon.usedCount >= coupon.usageLimitTotal) {
            return NextResponse.json({
                valid: false,
                error: 'This coupon has reached its usage limit'
            }, { status: 400 });
        }

        const userUsageQuery = await db
            .collection('couponUsages')
            .where('couponId', '==', coupon.id)
            .where('userId', '==', userId)
            .get();

        const userUsageCount = userUsageQuery.size;
        const perUserLimit = coupon.usageLimitPerUser || 1;

        if (userUsageCount >= perUserLimit) {
            return NextResponse.json({
                valid: false,
                error: `You have already used this coupon ${perUserLimit} time(s)`
            }, { status: 400 });
        }

        if (coupon.applicableCompetitionIds && coupon.applicableCompetitionIds.length > 0) {
            if (!competitionId || !coupon.applicableCompetitionIds.includes(competitionId)) {
                return NextResponse.json({
                    valid: false,
                    error: 'This coupon is not valid for this competition'
                }, { status: 400 });
            }
        }

        if (coupon.newUsersOnly) {
            const userRegsQuery = await db
                .collection('registrations')
                .where('userId', '==', userId)
                .limit(1)
                .get();

            if (!userRegsQuery.empty) {
                return NextResponse.json({
                    valid: false,
                    error: 'This coupon is only valid for new users'
                }, { status: 400 });
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
                return NextResponse.json({
                    valid: false,
                    error: 'Invalid coupon type'
                }, { status: 400 });
        }

        return NextResponse.json({
            valid: true,
            coupon: {
                id: coupon.id,
                code: coupon.code,
                type: coupon.type,
                value: coupon.value,
            },
            originalAmount,
            discountAmount,
            finalAmount,
            message: coupon.type === 'full'
                ? 'Coupon applied - Free entry!'
                : coupon.type === 'flat'
                    ? `Coupon applied - ₹${coupon.value} off!`
                    : `Coupon applied - ${coupon.value}% off!`
        });

    } catch (error) {
        console.error('Coupon validation error:', error);
        return NextResponse.json({
            valid: false,
            error: error.message || 'Failed to validate coupon'
        }, { status: 500 });
    }
}