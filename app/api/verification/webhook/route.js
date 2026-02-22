export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabase } from '@/lib/supabase';

function verifyWebhookSignature(payload, signature, secret) {
  if (!signature || !secret) return false;
  
  const expectedSignature = createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expectedSignature;
}

function hashString(str) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(str || '').digest('hex');
}

export async function POST(request) {
  try {
    const body = await request.json();
    const signature = request.headers.get('x-didit-signature');
    const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET;

    console.log('Webhook received, DIDIT_WEBHOOK_SECRET exists:', !!webhookSecret);
    console.log('Webhook body:', JSON.stringify(body).substring(0, 500));

    if (webhookSecret && webhookSecret !== 'your_webhook_secret_here') {
      const isValid = verifyWebhookSignature(body, signature, webhookSecret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const { session_id, status, vendor_data, result } = body;

    if (!vendor_data) {
      return NextResponse.json({ error: 'No vendor data' }, { status: 400 });
    }

    const userId = vendor_data;

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (userError || !userData) {
      console.error('User not found for webhook:', userId);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (status === 'approved') {
      const faceHash = result?.face?.hash || hashString(result?.face?.data || session_id);
      const documentHash = result?.document?.hash || hashString(result?.document?.data || session_id);
      const country = result?.country || null;
      const fullName = result?.full_name || userData.name || null;

      const { data: existingFaceData } = await supabase
        .from('identityindex')
        .select('*')
        .eq('id', faceHash)
        .single();

      const { data: existingDocData } = await supabase
        .from('identityindex')
        .select('*')
        .eq('id', documentHash)
        .single();

      if (existingFaceData || existingDocData) {
        await supabase
          .from('users')
          .update({
            verificationstatus: 'REJECTED',
            duplicatedetected: true,
            suspiciousverification: true,
            lastverificationresult: {
              status: status,
              rejectedat: new Date().toISOString(),
              reason: 'DUPLICATE_IDENTITY'
            }
          })
          .eq('id', userId);

        return NextResponse.json({
          success: true,
          message: 'Duplicate identity detected',
          duplicate: true
        });
      }

      await supabase
        .from('identityindex')
        .upsert({
          id: faceHash,
          userid: userId,
          type: 'FACE',
          createdat: new Date().toISOString()
        });

      await supabase
        .from('identityindex')
        .upsert({
          id: documentHash,
          userid: userId,
          type: 'DOCUMENT',
          createdat: new Date().toISOString()
        });

      await supabase
        .from('users')
        .update({
          verificationstatus: 'VERIFIED',
          facehash: faceHash,
          documenthash: documentHash,
          verificationcountry: country,
          verifiedat: new Date().toISOString(),
          verificationlevel: 1,
          duplicatedetected: false,
          suspiciousverification: false,
          lastverificationresult: {
            status: status,
            approvedat: new Date().toISOString(),
            fullName: fullName,
            country: country
          }
        })
        .eq('id', userId);

      return NextResponse.json({
        success: true,
        message: 'Verification approved',
        verified: true
      });

    } else if (status === 'declined' || status === 'rejected') {
      const rejectionReason = result?.reason || 'Unknown reason';

      await supabase
        .from('users')
        .update({
          verificationstatus: 'REJECTED',
          lastverificationresult: {
            status: status,
            rejectedat: new Date().toISOString(),
            reason: rejectionReason
          }
        })
        .eq('id', userId);

      return NextResponse.json({
        success: true,
        message: 'Verification rejected',
        verified: false
      });

    } else if (status === 'in_review') {
      return NextResponse.json({
        success: true,
        message: 'Verification in review'
      });

    } else {
      return NextResponse.json({
        success: true,
        message: 'Status received',
        status: status
      });
    }

  } catch (error) {
    console.error('Webhook error:', error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}