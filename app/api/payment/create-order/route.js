import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export async function POST(request) {
  try {
    const { amount, currency } = await request.json();

    // Razorpay always expects amount in smallest currency unit (paise for INR)
    // If currency is USD, we convert to INR (x90) as per requirement
    
    let finalAmount = amount;
    let finalCurrency = currency;

    if (currency === 'USD') {
      finalAmount = Math.round(amount * 90 * 100); // USD -> INR (x90) -> Paise (x100)
      finalCurrency = 'INR';
    } else {
      finalAmount = Math.round(amount * 100); // INR -> Paise (x100)
    }

    const options = {
      amount: finalAmount,
      currency: finalCurrency,
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    return NextResponse.json(order);
  } catch (error) {
    console.error('Razorpay Error:', error);
    return NextResponse.json({ error: 'Error creating order' }, { status: 500 });
  }
}