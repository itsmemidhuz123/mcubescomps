export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

let adminDb = null;

function parsePrivateKey(privateKey) {
    if (!privateKey) return null;
    if (privateKey.includes('\n') && !privateKey.includes('\\n')) {
        return privateKey;
    }
    return privateKey.replace(/\\n/g, '\n');
}

async function getDb() {
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

function hashString(str) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(str || '').digest('hex');
}

export async function POST(request) {
    try {
        const db = await getDb();
        const { userId } = await request.json();
        const authHeader = request.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();

        if (userData.verificationStatus === 'VERIFIED') {
            return NextResponse.json({ error: 'User is already verified' }, { status: 400 });
        }

        if (userData.verificationLockedUntil) {
            const lockUntil = userData.verificationLockedUntil.toDate ? userData.verificationLockedUntil.toDate() : new Date(userData.verificationLockedUntil);
            if (lockUntil > new Date()) {
                return NextResponse.json({
                    error: 'Verification temporarily locked',
                    lockedUntil: lockUntil.toISOString()
                }, { status: 429 });
            }
        }

        const maxAttempts = 3;
        const attemptCount = userData.verificationAttemptCount || 0;

        if (attemptCount >= maxAttempts) {
            if (userData.lastVerificationAttemptAt) {
                const lastAttemptDate = userData.lastVerificationAttemptAt.toDate ? userData.lastVerificationAttemptAt.toDate() : new Date(userData.lastVerificationAttemptAt);
                const hoursSinceLastAttempt = (new Date() - lastAttemptDate) / (1000 * 60 * 60);

                if (hoursSinceLastAttempt < 24) {
                    return NextResponse.json({
                        error: 'Maximum verification attempts exceeded. Try again after 24 hours.',
                        attemptsRemaining: 0
                    }, { status: 429 });
                }
            }
        }

        const diditApiKey = process.env.DIDIT_API_KEY;
        const workflowId = process.env.DIDIT_WORKFLOW_ID;
        const webhookUrl = `${request.headers.get('origin') || 'https://mcubescomps.com'}/api/verification/webhook`;

        console.log('DIDIT_API_KEY exists:', !!diditApiKey);
        console.log('DIDIT_WORKFLOW_ID:', workflowId);

        if (!diditApiKey) {
            console.error('DIDIT API Key is missing');
            return NextResponse.json({ error: 'DIDIT not configured' }, { status: 500 });
        }

        const sessionResponse = await fetch('https://verification.didit.me/v3/session/', {
            method: 'POST',
            headers: {
                'x-api-key': diditApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                workflow_id: workflowId,
                callback: webhookUrl,
                vendor_data: userId
            })
        });

        if (!sessionResponse.ok) {
            const errorText = await sessionResponse.text();
            console.error('DIDIT session creation failed:', errorText);
            return NextResponse.json({ error: 'Failed to create verification session', details: errorText }, { status: 500 });
        }

        const sessionData = await sessionResponse.json();
        console.log('DIDIT session created successfully:', sessionData.session_id);

        const newAttemptCount = userData.verificationStatus === 'PENDING' ? attemptCount : attemptCount + 1;

        await db.collection('users').doc(userId).update({
            diditSessionId: sessionData.session_id,
            diditWorkflowId: workflowId,
            verificationStatus: 'PENDING',
            verificationAttemptCount: newAttemptCount,
            lastVerificationAttemptAt: new Date(),
            verificationRequestedAt: new Date()
        });

        return NextResponse.json({
            success: true,
            sessionToken: sessionData.session_token,
            verificationUrl: sessionData.verification_url,
            sessionId: sessionData.session_id,
            attemptsRemaining: maxAttempts - newAttemptCount
        });

    } catch (error) {
        console.error('Verification start error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}