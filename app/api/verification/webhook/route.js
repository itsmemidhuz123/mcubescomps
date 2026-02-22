export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

let adminDb = null;

function parsePrivateKey(privateKey) {
  if (!privateKey) return null;
  if (privateKey.includes('\n') && !privateKey.includes('\\n')) {
    return privateKey;
  }
  return privateKey.replace(/\\n/g, '\n');
}

async function initializeAdmin() {
  if (adminDb) return adminDb;
  
  try {
    const { initializeApp, getApps, cert } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');
    
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
    
    if (!projectId || !clientEmail || !privateKeyRaw) {
      console.error('Missing Firebase Admin env vars');
      throw new Error('Missing Firebase environment variables');
    }
    
    const privateKey = parsePrivateKey(privateKeyRaw);
    
    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
    }
    
    adminDb = getFirestore();
    return adminDb;
  } catch (error) {
    console.error('Firebase Admin init error:', error.message);
    throw error;
  }
}

function verifyWebhookSignature(payload, signature, secret) {
  if (!signature || !secret) return false;
  
  const expectedSignature = createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expectedSignature;
}

function hashString(str) {
  const crypto = require('crypto');
  return createHmac('sha256', '').update(str || '').digest('hex');
}

export async function POST(request) {
  try {
    const db = await initializeAdmin();

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

    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.error('User not found for webhook:', userId);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();

    if (status === 'approved') {
      const faceHash = result?.face?.hash || hashString(result?.face?.data || session_id);
      const documentHash = result?.document?.hash || hashString(result?.document?.data || session_id);
      const country = result?.country || null;
      const fullName = result?.full_name || userData.displayName || null;
      const dateOfBirth = result?.date_of_birth || null;

      const existingFaceDoc = await db.collection('identityIndex').doc(faceHash).get();
      const existingDocDoc = await db.collection('identityIndex').doc(documentHash).get();

      if (existingFaceDoc.exists || existingDocDoc.exists) {
        const duplicateType = [];
        if (existingFaceDoc.exists) duplicateType.push('FACE');
        if (existingDocDoc.exists) duplicateType.push('DOCUMENT');

        await db.collection('auditLogs').add({
          action: 'DUPLICATE_DETECTED',
          userId: userId,
          userEmail: userData.email,
          details: {
            faceHash: faceHash,
            documentHash: documentHash,
            duplicateType: duplicateType,
            sessionId: session_id
          },
          timestamp: new Date(),
          performedBy: 'SYSTEM'
        });

        await db.collection('users').doc(userId).update({
          verificationStatus: 'REJECTED',
          duplicateDetected: true,
          suspiciousVerification: true,
          lastVerificationResult: {
            status: status,
            rejectedAt: new Date(),
            reason: 'DUPLICATE_IDENTITY'
          }
        });

        return NextResponse.json({
          success: true,
          message: 'Duplicate identity detected',
          duplicate: true
        });
      }

      await db.collection('identityIndex').doc(faceHash).set({
        userId: userId,
        type: 'FACE',
        createdAt: new Date()
      });

      await db.collection('identityIndex').doc(documentHash).set({
        userId: userId,
        type: 'DOCUMENT',
        createdAt: new Date()
      });

      await db.collection('auditLogs').add({
        action: 'VERIFICATION_APPROVED',
        userId: userId,
        userEmail: userData.email,
        details: {
          faceHash: faceHash,
          documentHash: documentHash,
          country: country,
          fullName: fullName,
          sessionId: session_id
        },
        timestamp: new Date(),
        performedBy: 'SYSTEM'
      });

      await db.collection('users').doc(userId).update({
        verificationStatus: 'VERIFIED',
        faceHash: faceHash,
        documentHash: documentHash,
        verificationCountry: country,
        verifiedAt: new Date(),
        verificationLevel: 1,
        duplicateDetected: false,
        suspiciousVerification: false,
        lastVerificationResult: {
          status: status,
          approvedAt: new Date(),
          fullName: fullName,
          country: country
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Verification approved',
        verified: true
      });

    } else if (status === 'declined' || status === 'rejected') {
      const rejectionReason = result?.reason || 'Unknown reason';

      await db.collection('auditLogs').add({
        action: 'VERIFICATION_REJECTED',
        userId: userId,
        userEmail: userData.email,
        details: {
          sessionId: session_id,
          reason: rejectionReason
        },
        timestamp: new Date(),
        performedBy: 'SYSTEM'
      });

      await db.collection('users').doc(userId).update({
        verificationStatus: 'REJECTED',
        lastVerificationResult: {
          status: status,
          rejectedAt: new Date(),
          reason: rejectionReason
        }
      });

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