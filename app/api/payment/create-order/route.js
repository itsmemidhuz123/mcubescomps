import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST(request) {
  try {
    // validate env vars
    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('Razorpay keys missing in environment variables');
      return NextResponse.json(
        { error: 'Server Config Error: Razorpay keys are missing in Vercel Environment Variables.' }, 
        { status: 500 }
      );
    }

    // Initialize Razorpay
    const razorpay = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const body = await request.json();
    const { amount, currency } = body;
    
    if (!amount) {
       return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Razorpay always expects amount in smallest currency unit (paise for INR)
    // If currency is USD, we convert to INR (x90) as per requirement
    
    let finalAmount = amount;
    let finalCurrency = currency;

    if (currency === 'USD') {
      // REQUIREMENT: 1 USD = 90 INR
      // Amount * 90 (to INR) * 100 (to Paise)
      finalAmount = Math.round(amount * 90 * 100); 
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