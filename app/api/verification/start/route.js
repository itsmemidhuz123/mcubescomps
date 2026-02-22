import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

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

export async function POST(request) {
    try {
        const { userId, sessionToken } = await request.json();

        if (!sessionToken) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const userDoc = await getDoc(doc(db, 'users', userId));

        if (!userDoc.exists()) {
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
            const lastAttempt = userData.lastVerificationAttemptAt;
            if (lastAttempt) {
                const lastAttemptDate = lastAttempt.toDate ? lastAttempt.toDate() : new Date(lastAttempt);
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

        if (!diditApiKey) {
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
            return NextResponse.json({ error: 'Failed to create verification session' }, { status: 500 });
        }

        const sessionData = await sessionResponse.json();

        const newAttemptCount = userData.verificationStatus === 'PENDING' ? attemptCount : attemptCount + 1;

        await updateDoc(doc(db, 'users', userId), {
            diditSessionId: sessionData.session_id,
            diditWorkflowId: workflowId,
            verificationStatus: 'PENDING',
            verificationAttemptCount: newAttemptCount,
            lastVerificationAttemptAt: serverTimestamp(),
            verificationRequestedAt: serverTimestamp()
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