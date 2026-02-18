import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

const adminDb = getFirestore();

export async function POST(request) {
    try {
        const { couponCode, userId, competitionId, originalAmount } = await request.json();

        if (!couponCode || !userId || originalAmount === undefined) {
            return NextResponse.json({
                valid: false,
                error: 'Missing required fields'
            }, { status: 400 });
        }

        const couponQuery = await adminDb
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

        const userUsageQuery = await adminDb
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
            const userRegsQuery = await adminDb
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
            error: 'Failed to validate coupon'
        }, { status: 500 });
    }
}