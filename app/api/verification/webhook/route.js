export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getVerificationData, updateVerificationStatus } from '@/lib/firebase-admin';

function verifyWebhookSignature(payload, signature, secret) {
  if (!signature || !secret) return false;
  
  const expectedSignature = createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expectedSignature;
}

function mapDiditStatus(diditStatus) {
  const statusMap = {
    'approved': 'VERIFIED',
    'Approved': 'VERIFIED',
    'declined': 'REJECTED',
    'Declined': 'REJECTED',
    'rejected': 'REJECTED',
    'Rejected': 'REJECTED',
    'in_review': 'PENDING',
    'In Review': 'PENDING',
    'pending': 'PENDING',
    'Pending': 'PENDING'
  };
  return statusMap[diditStatus] || 'PENDING';
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const verificationSessionId = searchParams.get('verificationSessionId');
    const status = searchParams.get('status');
    
    console.log('GET webhook - verificationSessionId:', verificationSessionId, 'status:', status);
    
    if (!verificationSessionId) {
      return NextResponse.redirect(new URL('/profile?verification=error', request.url));
    }
    
    let redirectStatus = 'pending';
    if (status === 'Approved') redirectStatus = 'approved';
    else if (status === 'Declined') redirectStatus = 'declined';
    else if (status === 'In Review') redirectStatus = 'pending';
    
    console.log('Redirecting to: /profile?verification=' + redirectStatus);
    return NextResponse.redirect(new URL('/profile?verification=' + redirectStatus, request.url));
    
  } catch (error) {
    console.error('GET webhook error:', error.message);
    return NextResponse.redirect(new URL('/profile?verification=error', request.url));
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const signature = request.headers.get('x-didit-signature');
    const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET;

    console.log('Webhook POST received');
    console.log('Webhook body:', JSON.stringify(body).substring(0, 500));

    if (webhookSecret && webhookSecret !== 'your_webhook_secret_here') {
      const isValid = verifyWebhookSignature(body, signature, webhookSecret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const { session_id, status: diditStatus, vendor_data, result } = body;

    if (!vendor_data) {
      return NextResponse.json({ error: 'No vendor data' }, { status: 400 });
    }

    const userId = vendor_data;
    const mappedStatus = mapDiditStatus(diditStatus);

    console.log('DIDIT status:', diditStatus, '-> mapped to:', mappedStatus);

    if (mappedStatus === 'VERIFIED') {
      const updateData = {
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date().toISOString(),
        verificationLevel: 1,
        duplicateDetected: false,
        suspiciousVerification: false,
        lastVerificationResult: {
          status: diditStatus,
          approvedAt: new Date().toISOString()
        }
      };

      await updateVerificationStatus(userId, updateData);

      return NextResponse.json({
        success: true,
        message: 'Verification approved',
        verified: true
      });

    } else if (mappedStatus === 'REJECTED') {
      const rejectionReason = result?.reason || 'Verification was declined';

      const updateData = {
        verificationStatus: 'REJECTED',
        lastVerificationResult: {
          status: diditStatus,
          rejectedAt: new Date().toISOString(),
          reason: rejectionReason
        }
      };

      await updateVerificationStatus(userId, updateData);

      return NextResponse.json({
        success: true,
        message: 'Verification rejected',
        verified: false
      });

    } else if (mappedStatus === 'PENDING') {
      const updateData = {
        verificationStatus: 'PENDING',
        lastVerificationResult: {
          status: diditStatus,
          inReviewAt: new Date().toISOString()
        }
      };

      await updateVerificationStatus(userId, updateData);

      return NextResponse.json({
        success: true,
        message: 'Verification in review'
      });

    } else {
      return NextResponse.json({
        success: true,
        message: 'Status received',
        status: mappedStatus
      });
    }

  } catch (error) {
    console.error('Webhook error:', error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}