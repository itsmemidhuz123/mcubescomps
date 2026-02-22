export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';

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

        console.log('Webhook POST received, DIDIT_WEBHOOK_SECRET exists:', !!webhookSecret);
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
        const supabase = getSupabaseAdmin();

        const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (fetchError || !existingUser) {
            console.log('User not in Supabase for webhook, creating record...');
            const { error: insertError } = await supabase
                .from('users')
                .upsert({
                    id: userId,
                    email: ''
                }, { onConflict: 'id' });

            if (insertError) {
                console.error('Failed to create user in webhook:', insertError);
            }
        }

        const mappedStatus = mapDiditStatus(diditStatus);
        console.log('DIDIT status:', diditStatus, '-> mapped to:', mappedStatus);

        if (mappedStatus === 'VERIFIED') {
            const faceHash = result?.face?.hash || hashString(result?.face?.data || session_id);
            const documentHash = result?.document?.hash || hashString(result?.document?.data || session_id);
            const country = result?.country || null;
            const fullName = result?.full_name || null;

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
                        verification_status: 'REJECTED',
                        duplicate_detected: true,
                        suspicious_verification: true,
                        last_verification_result: {
                            status: diditStatus,
                            rejected_at: new Date().toISOString(),
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
                    user_id: userId,
                    type: 'FACE',
                    created_at: new Date().toISOString()
                });

            await supabase
                .from('identityindex')
                .upsert({
                    id: documentHash,
                    user_id: userId,
                    type: 'DOCUMENT',
                    created_at: new Date().toISOString()
                });

            await supabase
                .from('users')
                .update({
                    verification_status: 'VERIFIED',
                    face_hash: faceHash,
                    document_hash: documentHash,
                    verification_country: country,
                    verified_at: new Date().toISOString(),
                    verification_level: 1,
                    duplicate_detected: false,
                    suspicious_verification: false,
                    last_verification_result: {
                        status: diditStatus,
                        approved_at: new Date().toISOString(),
                        full_name: fullName,
                        country: country
                    }
                })
                .eq('id', userId);

            return NextResponse.json({
                success: true,
                message: 'Verification approved',
                verified: true
            });

        } else if (mappedStatus === 'REJECTED') {
            const rejectionReason = result?.reason || 'Verification was declined';

            await supabase
                .from('users')
                .update({
                    verification_status: 'REJECTED',
                    last_verification_result: {
                        status: diditStatus,
                        rejected_at: new Date().toISOString(),
                        reason: rejectionReason
                    }
                })
                .eq('id', userId);

            return NextResponse.json({
                success: true,
                message: 'Verification rejected',
                verified: false
            });

        } else if (mappedStatus === 'PENDING') {
            await supabase
                .from('users')
                .update({
                    verification_status: 'PENDING',
                    last_verification_result: {
                        status: diditStatus,
                        in_review_at: new Date().toISOString()
                    }
                })
                .eq('id', userId);

            return NextResponse.json({
                success: true,
                message: 'Verification in review',
                status: 'PENDING'
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