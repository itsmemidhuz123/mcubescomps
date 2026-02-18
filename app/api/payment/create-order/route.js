import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

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
        const { amount, currency, couponCode, couponId, discountAmount, finalAmount } = body;

        if (!amount) {
            return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
        }

        const payAmount = finalAmount !== undefined ? finalAmount : amount;

        if (payAmount === 0) {
            return NextResponse.json({
                id: `coupon_free_${Date.now()}`,
                amount: 0,
                currency: currency || 'INR',
                isFreeOrder: true,
                coupon: {
                    couponId,
                    couponCode,
                    originalAmount: amount,
                    discountAmount: discountAmount || amount,
                    finalAmount: 0
                }
            });
        }

        let razorpayAmount = payAmount;
        let finalCurrency = currency;

        if (currency === 'USD') {
            razorpayAmount = Math.round(payAmount * 90 * 100);
            finalCurrency = 'INR';
        } else {
            razorpayAmount = Math.round(payAmount * 100);
        }

        const options = {
            amount: razorpayAmount,
            currency: finalCurrency,
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);

        return NextResponse.json({
            ...order,
            originalAmount: amount,
            discountAmount: discountAmount || 0,
            finalAmount: payAmount
        });

    } catch (error) {
        console.error('Razorpay Error:', error);
        return NextResponse.json({ error: 'Error creating order' }, { status: 500 });
    }
}