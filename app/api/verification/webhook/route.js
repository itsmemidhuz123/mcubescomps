export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createClient } from '@supabase/supabase-js';

let supabase = null;

function getSupabase() {
    if (supabase) return supabase;
    supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY
    );
    return supabase;
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
    return crypto.createHash('sha256').update(str || '').digest('hex');
}

export async function POST(request) {
    try {
        const sb = getSupabase();
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

        const { data: user, error: userError } = await sb
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            console.error('User not found for webhook:', userId);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (status === 'approved') {
            const faceHash = result?.face?.hash || hashString(result?.face?.data || session_id);
            const documentHash = result?.document?.hash || hashString(result?.document?.data || session_id);
            const country = result?.country || null;
            const fullName = result?.full_name || user.name || null;

            const { data: existingFace } = await sb
                .from('identityIndex')
                .select('*')
                .eq('id', faceHash)
                .single();

            const { data: existingDoc } = await sb
                .from('identityIndex')
                .select('*')
                .eq('id', documentHash)
                .single();

            if (existingFace || existingDoc) {
                await sb
                    .from('users')
                    .update({
                        verificationStatus: 'REJECTED',
                        duplicateDetected: true,
                        suspiciousVerification: true,
                        lastVerificationResult: {
                            status: status,
                            rejectedAt: new Date().toISOString(),
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

            await sb.from('identityIndex').insert({
                id: faceHash,
                userId: userId,
                type: 'FACE'
            });

            await sb.from('identityIndex').insert({
                id: documentHash,
                userId: userId,
                type: 'DOCUMENT'
            });

            await sb
                .from('users')
                .update({
                    verificationStatus: 'VERIFIED',
                    faceHash: faceHash,
                    documentHash: documentHash,
                    verificationCountry: country,
                    verifiedAt: new Date().toISOString(),
                    verificationLevel: 1,
                    duplicateDetected: false,
                    suspiciousVerification: false,
                    lastVerificationResult: {
                        status: status,
                        approvedAt: new Date().toISOString(),
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

            await sb
                .from('users')
                .update({
                    verificationStatus: 'REJECTED',
                    lastVerificationResult: {
                        status: status,
                        rejectedAt: new Date().toISOString(),
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