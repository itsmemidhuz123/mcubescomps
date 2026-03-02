import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import crypto from 'crypto';

// Initialize Razorpay with error handling
let razorpay = null;
const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

try {
  if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET
    });
    console.log('Razorpay initialized successfully');
  } else {
    console.warn('Razorpay keys not found in environment:', {
      hasKeyId: !!RAZORPAY_KEY_ID,
      hasKeySecret: !!RAZORPAY_KEY_SECRET
    });
  }
} catch (e) {
  console.error('Failed to initialize Razorpay:', e);
}

export async function POST(request) {
  const { pathname } = new URL(request.url);
  
  // Debug logging
  console.log('POST request to:', pathname);

  // Create Razorpay order - match with or without trailing slash
  if (pathname === '/api/payment/create-order' || pathname.includes('payment/create-order')) {
    try {
      if (!razorpay) {
        return NextResponse.json({ error: 'Payment service not configured' }, { status: 500 });
      }
      
      const { amount, currency, userId, competitionId, events } = await request.json();

      const options = {
        amount: Math.round(amount * 100), // Convert to paise/cents
        currency: currency || 'INR',
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

  // Verify payment - match with or without trailing slash
  if (pathname === '/api/payment/verify' || pathname.includes('payment/verify')) {
    try {
      const body = await request.json();
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, competitionId, competitionName, events, amount, currency } = body;

      // Verify signature
      const sign = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSign = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET || '')
        .update(sign)
        .digest('hex');

      if (razorpay_signature !== expectedSign) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }

      // Return success - client will save to Firestore
      return NextResponse.json({ 
        success: true,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        verified: true
      });
    } catch (error) {
      console.error('Verify payment error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Submit solve - just return success, client handles Firestore
  if (pathname === '/api/competition/submit-solve') {
    try {
      const { userId, competitionId, eventId, attemptNumber, time, penalty } = await request.json();
      
      // Validate the solve
      if (!userId || !competitionId || !eventId || attemptNumber === undefined) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }
      
      if (typeof time !== 'number' && penalty !== 'DNF') {
        return NextResponse.json({ error: 'Invalid time' }, { status: 400 });
      }
      
      // Anti-cheat: minimum solve time (500ms = 0.5 seconds)
      if (time < 500 && penalty !== 'DNF') {
        return NextResponse.json({ error: 'Invalid solve time - too fast' }, { status: 400 });
      }
      
      // Return validated data for client to save
      return NextResponse.json({ 
        success: true,
        validated: true,
        solve: {
          userId,
          competitionId,
          eventId,
          attemptNumber,
          time,
          penalty,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Submit solve error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Calculate results
  if (pathname === '/api/competition/calculate-results') {
    try {
      const { userId, competitionId, eventId, solves } = await request.json();
      
      if (!solves || solves.length < 5) {
        return NextResponse.json({ error: 'Need at least 5 solves' }, { status: 400 });
      }

      // Calculate times with penalties
      const times = solves.map(solve => {
        if (solve.penalty === 'DNF') return Infinity;
        if (solve.penalty === '+2') return solve.time + 2000;
        return solve.time;
      });

      // Check for DNF count
      const dnfCount = times.filter(t => t === Infinity).length;
      let average = 'DNF';
      let bestSingle = Math.min(...times.filter(t => t !== Infinity));
      if (bestSingle === Infinity) bestSingle = 'DNF';

      if (dnfCount <= 1) {
        // Calculate Ao5: remove best and worst, average the middle 3
        const sorted = [...times].sort((a, b) => a - b);
        const middle3 = sorted.slice(1, 4);
        if (!middle3.some(t => t === Infinity)) {
          average = Math.round(middle3.reduce((a, b) => a + b, 0) / 3);
        }
      }

      return NextResponse.json({ 
        success: true,
        result: {
          userId,
          competitionId,
          eventId,
          times,
          average,
          bestSingle,
          calculatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Calculate results error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function GET(request) {
  const { pathname, searchParams } = new URL(request.url);

  // Health check
  if (pathname === '/api/health') {
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
