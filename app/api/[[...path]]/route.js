import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { doc, setDoc, getDoc, collection, addDoc, updateDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

export async function POST(request) {
  const { pathname } = new URL(request.url);

  // Create Razorpay order
  if (pathname === '/api/payment/create-order') {
    try {
      const { amount, currency, userId, competitionId, events } = await request.json();

      const options = {
        amount: amount * 100, // Convert to paise/cents
        currency,
        receipt: `comp_${competitionId}_${Date.now()}`,
        notes: {
          userId,
          competitionId,
          events: JSON.stringify(events)
        }
      };

      const order = await razorpay.orders.create(options);
      return NextResponse.json(order);
    } catch (error) {
      console.error('Create order error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Verify payment
  if (pathname === '/api/payment/verify') {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, competitionId, events } = await request.json();

      const sign = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSign = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest('hex');

      if (razorpay_signature === expectedSign) {
        // Payment verified, create registration
        await setDoc(doc(db, 'registrations', `${userId}_${competitionId}`), {
          userId,
          competitionId,
          events,
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          status: 'PAID',
          registeredAt: new Date().toISOString()
        });

        // Store payment record
        await addDoc(collection(db, 'payments'), {
          userId,
          competitionId,
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          amount: 0, // Get from order
          currency: 'INR',
          status: 'SUCCESS',
          createdAt: new Date().toISOString()
        });

        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    } catch (error) {
      console.error('Verify payment error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Register for free competition
  if (pathname === '/api/competition/register') {
    try {
      const { userId, competitionId, events } = await request.json();

      // Check if already registered
      const regDoc = await getDoc(doc(db, 'registrations', `${userId}_${competitionId}`));
      if (regDoc.exists()) {
        return NextResponse.json({ error: 'Already registered' }, { status: 400 });
      }

      await setDoc(doc(db, 'registrations', `${userId}_${competitionId}`), {
        userId,
        competitionId,
        events,
        status: 'FREE',
        registeredAt: new Date().toISOString()
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Registration error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Submit solve
  if (pathname === '/api/competition/submit-solve') {
    try {
      const { userId, competitionId, eventId, attemptNumber, time, penalty } = await request.json();

      await addDoc(collection(db, 'solves'), {
        userId,
        competitionId,
        eventId,
        attemptNumber,
        time,
        penalty,
        timestamp: new Date().toISOString()
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Submit solve error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Calculate and save results
  if (pathname === '/api/competition/calculate-results') {
    try {
      const { userId, competitionId, eventId } = await request.json();

      // Get all solves for this user/competition/event
      const solvesQuery = query(
        collection(db, 'solves'),
        where('userId', '==', userId),
        where('competitionId', '==', competitionId),
        where('eventId', '==', eventId),
        orderBy('attemptNumber', 'asc')
      );

      const solvesSnapshot = await getDocs(solvesQuery);
      const solves = solvesSnapshot.docs.map(doc => doc.data());

      if (solves.length < 5) {
        return NextResponse.json({ error: 'Not enough solves' }, { status: 400 });
      }

      // Calculate times with penalties
      const times = solves.map(solve => {
        if (solve.penalty === 'DNF') return Infinity;
        if (solve.penalty === '+2') return solve.time + 2000;
        return solve.time;
      });

      // Check for DNF
      const dnfCount = times.filter(t => t === Infinity).length;
      let average = 'DNF';
      let bestSingle = Math.min(...times.filter(t => t !== Infinity));

      if (dnfCount <= 1) {
        // Calculate Ao5: remove best and worst, average the middle 3
        const sorted = [...times].sort((a, b) => a - b);
        const middle3 = sorted.slice(1, 4);
        average = middle3.reduce((a, b) => a + b, 0) / 3;
      }

      // Save result
      await setDoc(doc(db, 'results', `${userId}_${competitionId}_${eventId}`), {
        userId,
        competitionId,
        eventId,
        times,
        average,
        bestSingle,
        calculatedAt: new Date().toISOString()
      });

      return NextResponse.json({ average, bestSingle });
    } catch (error) {
      console.error('Calculate results error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function GET(request) {
  const { pathname, searchParams } = new URL(request.url);

  // Get registration status
  if (pathname === '/api/competition/registration-status') {
    try {
      const userId = searchParams.get('userId');
      const competitionId = searchParams.get('competitionId');

      const regDoc = await getDoc(doc(db, 'registrations', `${userId}_${competitionId}`));

      if (regDoc.exists()) {
        return NextResponse.json(regDoc.data());
      }

      return NextResponse.json({ registered: false });
    } catch (error) {
      console.error('Get registration error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
