export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabase, getSupabaseAdmin } from '@/lib/supabase';

function hashString(str) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(str || '').digest('hex');
}

async function getUserFromFirebase(userId) {
    try {
        const { initializeApp, getApps, cert } = require('firebase-admin/app');
        const { getFirestore } = require('firebase-admin/firestore');

        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

        if (!projectId || !clientEmail || !privateKeyRaw) {
            console.log('Firebase Admin env vars not configured');
            return null;
        }

        const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

        if (getApps().length === 0) {
            initializeApp({
                credential: cert({ projectId, clientEmail, privateKey })
            });
        }

        const db = getFirestore();
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) return null;
        return userDoc.data();
    } catch (error) {
        console.error('Error fetching from Firebase:', error.message);
        return null;
    }
}

export async function POST(request) {
    try {
        const { userId } = await request.json();
        const authHeader = request.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const supabase = getSupabase();

        let userData = null;
        let userError = null;

        const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (fetchError || !existingUser) {
            console.log('User not in Supabase, fetching from Firebase...');
            const firebaseUser = await getUserFromFirebase(userId);

            let userEmail = '';
            let userName = null;
            let userPicture = null;

            if (firebaseUser) {
                userEmail = firebaseUser.email || '';
                userName = firebaseUser.displayName || firebaseUser.name || null;
                userPicture = firebaseUser.photoURL || null;
            } else {
                console.log('Firebase fetch failed, using userId as fallback');
            }

            // Use admin client to bypass RLS
            const supabaseAdmin = getSupabaseAdmin();

            const { error: insertError } = await supabaseAdmin
                .from('users')
                .upsert({
                    id: userId,
                    email: userEmail,
                    name: userName,
                    picture: userPicture,
                    verification_status: 'UNVERIFIED',
                    verification_attempt_count: 0
                }, { onConflict: 'id' });

            if (insertError) {
                console.error('User insert error:', insertError);
            }

            // Fetch the user
            const { data: userRecord } = await supabaseAdmin
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (userRecord) {
                userData = userRecord;
            } else {
                // Create user data object from input
                userData = {
                    id: userId,
                    email: userEmail,
                    name: userName,
                    verification_status: 'UNVERIFIED',
                    verification_attempt_count: 0
                };
            }
        } else {
            userData = existingUser;
        }

        // Check both column names for backward compatibility
        const currentStatus = userData.verification_status || userData.verificationstatus || 'UNVERIFIED';
        const currentAttemptCount = userData.verification_attempt_count || userData.verificationattemptcount || 0;
        const currentLastAttemptAt = userData.last_verification_attempt_at || userData.lastverificationattemptat || null;

        if (currentStatus === 'VERIFIED') {
            return NextResponse.json({ error: 'User is already verified' }, { status: 400 });
        }

        const maxAttempts = 3;
        const attemptCount = currentAttemptCount;

        if (attemptCount >= maxAttempts) {
            if (currentLastAttemptAt) {
                const lastAttemptDate = new Date(currentLastAttemptAt);
                const hoursSinceLastAttempt = (new Date() - lastAttemptDate) / (1000 * 60 * 60);

                if (hoursSinceLastAttempt < 24) {
                    return NextResponse.json({
                        error: 'Maximum verification attempts exceeded. Try again after 24 hours.',
                        attemptsRemaining: 0,
                        retryAfter: Math.ceil(24 - hoursSinceLastAttempt)
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

        // Check both column names for backward compatibility (already done above)
        const newAttemptCount = currentStatus === 'PENDING' ? attemptCount : attemptCount + 1;

        console.log('Updating user status to PENDING. Current status:', currentStatus);

        const supabaseAdmin = getSupabaseAdmin();
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
                didit_session_id: sessionData.session_id,
                didit_workflow_id: workflowId,
                verification_status: 'PENDING',
                verification_attempt_count: newAttemptCount,
                last_verification_attempt_at: new Date().toISOString(),
                verification_requested_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (updateError) {
            console.error('Failed to update user:', updateError);
            return NextResponse.json({ error: 'Failed to update verification status' }, { status: 500 });
        }

        // DIDIT returns 'url' field, not 'verification_url'
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