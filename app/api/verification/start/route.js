export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getVerificationData, updateVerificationStatus } from '@/lib/firebase-admin';

export async function POST(request) {
    try {
        const { userId } = await request.json();
        const authHeader = request.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        console.log('Start verification for userId:', userId);

        const userData = await getVerificationData(userId);

        if (!userData) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const currentStatus = userData.verificationStatus || 'UNVERIFIED';
        const attemptCount = userData.verificationAttemptCount || 0;

        if (currentStatus === 'VERIFIED') {
            return NextResponse.json({ error: 'User is already verified' }, { status: 400 });
        }

        const maxAttempts = 3;

        if (attemptCount >= maxAttempts) {
            if (userData.lastVerificationAttemptAt) {
                const lastAttemptDate = new Date(userData.lastVerificationAttemptAt);
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
        console.log('DIDIT session response:', JSON.stringify(sessionData));

        const newAttemptCount = currentStatus === 'PENDING' ? attemptCount : attemptCount + 1;

        // Update in Firestore
        const updateResult = await updateVerificationStatus(userId, {
            diditSessionId: sessionData.session_id,
            diditWorkflowId: workflowId,
            verificationStatus: 'PENDING',
            verificationAttemptCount: newAttemptCount,
            lastVerificationAttemptAt: new Date().toISOString(),
            verificationRequestedAt: new Date().toISOString()
        });

        if (updateResult.error) {
            console.error('Failed to update user:', updateResult.error);
            return NextResponse.json({ error: 'Failed to update verification status' }, { status: 500 });
        }

        console.log('Updated user status to PENDING');

        return NextResponse.json({
            success: true,
            sessionToken: sessionData.session_token,
            verificationUrl: sessionData.url || sessionData.verification_url,
            sessionId: sessionData.session_id,
            attemptsRemaining: maxAttempts - newAttemptCount
        });

    } catch (error) {
        console.error('Verification start error:', error.message);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}