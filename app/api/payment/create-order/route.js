import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

let adminDb = null;

async function getAdminDb() {
    if (adminDb) return adminDb;

    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    if (!getApps().length) {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;

        if (!projectId || !clientEmail || !privateKey) {
            return null;
        }

        privateKey = privateKey.replace(/\\n/g, '\n');

        initializeApp({
            credential: cert({ projectId, clientEmail, privateKey }),
        });
    }

    adminDb = getFirestore();
    return adminDb;
}

async function validateCouponServerSide(couponCode, userId, competitionId, originalAmount) {
    if (!couponCode) return null;

    const db = await getAdminDb();
    if (!db) {
        throw new Error('Database not available');
    }

    const couponQuery = await db
        .collection('coupons')
        .where('code', '==', couponCode.toUpperCase())
        .limit(1)
        .get();

    if (couponQuery.empty) {
        throw new Error('Invalid coupon code');
    }

    const couponDoc = couponQuery.docs[0];
    const coupon = { id: couponDoc.id, ...couponDoc.data() };

    if (!coupon.active) {
        throw new Error('Coupon has been deactivated');
    }

    if (coupon.expiresAt) {
        const expiryDate = coupon.expiresAt.toDate ? coupon.expiresAt.toDate() : new Date(coupon.expiresAt);
        if (new Date() > expiryDate) {
            throw new Error('Coupon has expired');
        }
    }

    if (coupon.usageLimitTotal && coupon.usedCount >= coupon.usageLimitTotal) {
        throw new Error('Coupon usage limit reached');
    }

    const userUsageQuery = await db
        .collection('couponUsages')
        .where('couponId', '==', coupon.id)
        .where('userId', '==', userId)
        .get();

    if (userUsageQuery.size >= (coupon.usageLimitPerUser || 1)) {
        throw new Error('Coupon already used by this user');
    }

    if (coupon.applicableCompetitionIds && coupon.applicableCompetitionIds.length > 0) {
        if (!competitionId || !coupon.applicableCompetitionIds.includes(competitionId)) {
            throw new Error('Coupon not valid for this competition');
        }
    }

    if (coupon.newUsersOnly) {
        const userRegsQuery = await db
            .collection('registrations')
            .where('userId', '==', userId)
            .limit(1)
            .get();

        if (!userRegsQuery.empty) {
            throw new Error('Coupon only valid for new users');
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

    return {
        couponId: coupon.id,
        couponCode: coupon.code,
        couponType: coupon.type,
        couponValue: coupon.value,
        originalAmount,
        discountAmount,
        finalAmount
    };
}

export async function POST(request) {
    try {
        if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            console.error('Razorpay keys missing in environment variables');
            return NextResponse.json(
                { error: 'Server Config Error: Razorpay keys are missing.' },
                { status: 500 }
            );
        }

        const razorpay = new Razorpay({
            key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const body = await request.json();
        const { amount, currency, couponCode, userId, competitionId } = body;

        if (!amount) {
            return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
        }

        let couponData = null;
        let finalAmount = amount;

        if (couponCode && userId) {
            try {
                couponData = await validateCouponServerSide(couponCode, userId, competitionId, amount);
                finalAmount = couponData.finalAmount;
            } catch (couponError) {
                return NextResponse.json({
                    error: couponError.message || 'Invalid coupon'
                }, { status: 400 });
            }
        }

        if (finalAmount === 0 && couponData) {
            return NextResponse.json({
                id: `coupon_free_${Date.now()}`,
                amount: 0,
                currency: currency || 'INR',
                isFreeOrder: true,
                coupon: couponData
            });
        }

        let razorpayAmount = finalAmount;
        let finalCurrency = currency;

        if (currency === 'USD') {
            razorpayAmount = Math.round(finalAmount * 90 * 100);
            finalCurrency = 'INR';
        } else {
            razorpayAmount = Math.round(finalAmount * 100);
        }

        const options = {
            amount: razorpayAmount,
            currency: finalCurrency,
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);

        return NextResponse.json({
            ...order,
            coupon: couponData,
            originalAmount: amount,
            discountAmount: couponData?.discountAmount || 0,
            finalAmount
        });

    } catch (error) {
        console.error('Razorpay Error:', error);
        return NextResponse.json({ error: 'Error creating order' }, { status: 500 });
    }
}