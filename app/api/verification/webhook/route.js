export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getVerificationData, getUserByDiditSession, updateVerificationStatus } from '@/lib/firebase-admin';

function verifyWebhookSignature(payload, signature, secret) {
    if (!signature || !secret) return false;

    const expectedSignature = createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

    return signature === expectedSignature;
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
        let finalStatus = 'PENDING';

        if (status === 'Approved' || status === 'approved') {
            redirectStatus = 'approved';
            finalStatus = 'VERIFIED';
        } else if (status === 'Declined' || status === 'declined' || status === 'Rejected' || status === 'rejected') {
            redirectStatus = 'declined';
            finalStatus = 'REJECTED';
        } else if (status === 'In Review') {
            redirectStatus = 'pending';
            finalStatus = 'PENDING';
        }

        const userData = await getUserByDiditSession(verificationSessionId);

        if (userData) {
            console.log('Found user:', userData.uid, 'current status:', userData.verificationStatus);

            if (userData.verificationStatus === 'VERIFIED') {
                console.log('User already verified, skipping update');
            } else if (userData.verificationStatus === 'BLOCKED') {
                console.log('User is blocked, skipping update');
            } else {
                const now = new Date().toISOString();

                if (finalStatus === 'VERIFIED') {
                    await updateVerificationStatus(userData.uid, {
                        verificationStatus: 'VERIFIED',
                        verifiedAt: now,
                        verificationLevel: 1,
                        duplicateDetected: false,
                        suspiciousVerification: false,
                        lastVerificationResult: {
                            status: status,
                            approvedAt: now
                        }
                    });
                    console.log('Updated user to VERIFIED');
                } else if (finalStatus === 'REJECTED') {
                    const attemptCount = (userData.verificationAttemptCount || 0) + 1;
                    const newStatus = attemptCount >= 3 ? 'BLOCKED' : 'REJECTED';

                    await updateVerificationStatus(userData.uid, {
                        verificationStatus: newStatus,
                        verificationAttemptCount: attemptCount,
                        lastVerificationAttemptAt: now,
                        lastVerificationResult: {
                            status: status,
                            rejectedAt: now,
                            reason: 'Verification was declined'
                        }
                    });
                    console.log('Updated user to', newStatus, 'attempts:', attemptCount);
                } else {
                    await updateVerificationStatus(userData.uid, {
                        verificationStatus: 'PENDING',
                        lastVerificationResult: {
                            status: status,
                            inReviewAt: now
                        }
                    });
                }
            }
        } else {
            console.log('User not found for session:', verificationSessionId);
        }

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

        console.log('Webhook POST received');
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
        const userData = await getVerificationData(userId);

        if (userData?.verificationStatus === 'VERIFIED') {
            console.log('User already verified, skipping POST update');
            return NextResponse.json({
                success: true,
                message: 'User already verified',
                verified: true
            });
        }

        if (userData?.verificationStatus === 'BLOCKED') {
            console.log('User is blocked, skipping POST update');
            return NextResponse.json({
                success: true,
                message: 'User is blocked',
                verified: false
            });
        }

        const mappedStatus = mapDiditStatus(diditStatus);
        const now = new Date().toISOString();

        console.log('DIDIT status:', diditStatus, '-> mapped to:', mappedStatus);

        if (mappedStatus === 'VERIFIED') {
            const updateData = {
                verificationStatus: 'VERIFIED',
                verifiedAt: now,
                verificationLevel: 1,
                duplicateDetected: result?.duplicate_detected || false,
                suspiciousVerification: false,
                lastVerificationResult: {
                    status: diditStatus,
                    approvedAt: now
                }
            };

            await updateVerificationStatus(userId, updateData);

            return NextResponse.json({
                success: true,
                message: 'Verification approved',
                verified: true
            });

        } else if (mappedStatus === 'REJECTED') {
            const rejectionReason = result?.reason || 'Verification was declined';
            const attemptCount = (userData?.verificationAttemptCount || 0) + 1;
            const newStatus = attemptCount >= 3 ? 'BLOCKED' : 'REJECTED';

            const updateData = {
                verificationStatus: newStatus,
                verificationAttemptCount: attemptCount,
                lastVerificationAttemptAt: now,
                lastVerificationResult: {
                    status: diditStatus,
                    rejectedAt: now,
                    reason: rejectionReason
                }
            };

            await updateVerificationStatus(userId, updateData);

            return NextResponse.json({
                success: true,
                message: newStatus === 'BLOCKED' ? 'Verification blocked - max attempts reached' : 'Verification rejected',
                verified: false,
                blocked: newStatus === 'BLOCKED'
            });

        } else if (mappedStatus === 'PENDING') {
            const updateData = {
                verificationStatus: 'PENDING',
                lastVerificationResult: {
                    status: diditStatus,
                    inReviewAt: now
                }
            };

            await updateVerificationStatus(userId, updateData);

            return NextResponse.json({
                success: true,
                message: 'Verification in review'
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