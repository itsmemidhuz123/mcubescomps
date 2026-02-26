import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { doc, setDoc, collection, addDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request) {
  try {
    // Validate env vars
    if (!process.env.RAZORPAY_KEY_SECRET) {
      console.error('RAZORPAY_KEY_SECRET is missing');
      return NextResponse.json(
        { error: 'Server Config Error: Razorpay Secret is missing in env vars.' }, 
        { status: 500 }
      );
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, competitionId, events, originalAmount, finalAmount, couponCode, discountAmount } = await request.json();

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      // Save payment to database
      try {
        const paymentData = {
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          userId,
          userEmail: (await getDoc(doc(db, 'users', userId))).data()?.email || 'unknown',
          competitionId,
          events: events || [],
          status: 'SUCCESS',
          currency: 'INR',
          originalAmount: originalAmount || finalAmount || 0,
          finalAmount: finalAmount || originalAmount || 0,
          couponCode: couponCode || null,
          discountAmount: discountAmount || 0,
          paymentMethod: 'razorpay',
          createdAt: new Date().toISOString(),
          verifiedAt: new Date().toISOString()
        };

        // Save payment to payments collection
        await addDoc(collection(db, 'payments'), paymentData);

        // Update user's registrations
        const registrationData = {
          userId,
          competitionId,
          events: events || [],
          status: 'REGISTERED',
          paymentStatus: 'PAID',
          paymentId: razorpay_payment_id,
          registeredAt: new Date().toISOString(),
          paymentCompletedAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'registrations'), registrationData);

        console.log('Payment saved successfully:', paymentData);
        
      } catch (dbError) {
        console.error('Error saving payment to database:', dbError);
        // Still return success for payment verification, but log the database error
      }

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 400 });
    }
  } catch (error) {
    console.error('Verification Error:', error);
    return NextResponse.json({ error: 'Error verifying payment' }, { status: 500 });
  }
}