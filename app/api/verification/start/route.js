export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBUH2hL2lR-nNi2jnWQWeeX00z8N-MQqO0",
    authDomain: "texcads-670e0.firebaseapp.com",
    databaseURL: "https://texcads-670e0-default-rtdb.firebaseio.com",
    projectId: "texcads-670e0",
    storageBucket: "texcads-670e0.firebasestorage.app",
    messagingSenderId: "586899233238",
    appId: "1:586899233238:web:9dbee74e14cd95f23f2c77"
};

function getFirestoreDb() {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    return getFirestore(app);
}

export async function POST(request) {
    try {
        const { userId } = await request.json();
        const authHeader = request.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (user.verificationStatus === 'VERIFIED') {
            return NextResponse.json({ error: 'User is already verified' }, { status: 400 });
        }

        if (user.verificationLockedUntil && user.verificationLockedUntil > new Date()) {
            return NextResponse.json({
                error: 'Verification temporarily locked',
                lockedUntil: user.verificationLockedUntil.toISOString()
            }, { status: 429 });
        }

        const maxAttempts = 3;
        const attemptCount = user.verificationAttemptCount || 0;

        if (attemptCount >= maxAttempts) {
            if (user.lastVerificationAttemptAt) {
                const hoursSinceLastAttempt = (new Date() - user.lastVerificationAttemptAt) / (1000 * 60 * 60);

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

        const newAttemptCount = user.verificationStatus === 'PENDING' ? attemptCount : attemptCount + 1;

        await prisma.user.update({
            where: { id: userId },
            data: {
                diditSessionId: sessionData.session_id,
                diditWorkflowId: workflowId,
                verificationStatus: 'PENDING',
                verificationAttemptCount: newAttemptCount,
                lastVerificationAttemptAt: new Date(),
                verificationRequestedAt: new Date()
            }
        });

        // Sync to Firebase for frontend compatibility
        try {
            const db = getFirestoreDb();
            await updateDoc(doc(db, 'users', userId), {
                verificationStatus: 'PENDING',
                diditSessionId: sessionData.session_id,
                verificationAttemptCount: newAttemptCount,
                lastVerificationAttemptAt: new Date(),
                verificationRequestedAt: new Date()
            });
        } catch (e) {
            console.error('Firebase sync error:', e);
        }

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