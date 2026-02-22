export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, setDoc, serverTimestamp, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { createHmac } from 'crypto';

const firebaseConfig = {
    apiKey: "AIzaSyBUH2hL2lR-nNi2jnWQWeeX00z8N-MQqO0",
    authDomain: "texcads-670e0.firebaseapp.com",
    databaseURL: "https://texcads-670e0-default-rtdb.firebaseio.com",
    projectId: "texcads-670e0",
    storageBucket: "texcads-670e0.firebasestorage.app",
    messagingSenderId: "586899233238",
    appId: "1:586899233238:web:9dbee74e14cd95f23f2c77"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

function verifyWebhookSignature(payload, signature, secret) {
    if (!signature || !secret) return false;

    const expectedSignature = createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

    return signature === expectedSignature;
}

function hashString(str) {
    return createHmac('sha256', '').update(str || '').digest('hex');
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

        const userDoc = await getDoc(doc(db, 'users', userId));

        if (!userDoc.exists()) {
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

            const existingFaceDoc = await getDoc(doc(db, 'identityIndex', faceHash));
            const existingDocDoc = await getDoc(doc(db, 'identityIndex', documentHash));

            if (existingFaceDoc.exists() || existingDocDoc.exists()) {
                const duplicateType = [];
                if (existingFaceDoc.exists()) duplicateType.push('FACE');
                if (existingDocDoc.exists()) duplicateType.push('DOCUMENT');

                await addDoc(collection(db, 'auditLogs'), {
                    action: 'DUPLICATE_DETECTED',
                    userId: userId,
                    userEmail: userData.email,
                    details: {
                        faceHash: faceHash,
                        documentHash: documentHash,
                        duplicateType: duplicateType,
                        sessionId: session_id
                    },
                    timestamp: serverTimestamp(),
                    performedBy: 'SYSTEM'
                });

                await updateDoc(doc(db, 'users', userId), {
                    verificationStatus: 'REJECTED',
                    duplicateDetected: true,
                    suspiciousVerification: true,
                    lastVerificationResult: {
                        status: status,
                        rejectedAt: serverTimestamp(),
                        reason: 'DUPLICATE_IDENTITY'
                    }
                });

                return NextResponse.json({
                    success: true,
                    message: 'Duplicate identity detected',
                    duplicate: true
                });
            }

            await setDoc(doc(db, 'identityIndex', faceHash), {
                userId: userId,
                type: 'FACE',
                createdAt: serverTimestamp()
            });

            await setDoc(doc(db, 'identityIndex', documentHash), {
                userId: userId,
                type: 'DOCUMENT',
                createdAt: serverTimestamp()
            });

            await addDoc(collection(db, 'auditLogs'), {
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
                timestamp: serverTimestamp(),
                performedBy: 'SYSTEM'
            });

            await updateDoc(doc(db, 'users', userId), {
                verificationStatus: 'VERIFIED',
                faceHash: faceHash,
                documentHash: documentHash,
                verificationCountry: country,
                verifiedAt: serverTimestamp(),
                verificationLevel: 1,
                duplicateDetected: false,
                suspiciousVerification: false,
                lastVerificationResult: {
                    status: status,
                    approvedAt: serverTimestamp(),
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

            await addDoc(collection(db, 'auditLogs'), {
                action: 'VERIFICATION_REJECTED',
                userId: userId,
                userEmail: userData.email,
                details: {
                    sessionId: session_id,
                    reason: rejectionReason
                },
                timestamp: serverTimestamp(),
                performedBy: 'SYSTEM'
            });

            await updateDoc(doc(db, 'users', userId), {
                verificationStatus: 'REJECTED',
                lastVerificationResult: {
                    status: status,
                    rejectedAt: serverTimestamp(),
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