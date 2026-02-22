export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { prisma } from '@/lib/prisma';

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

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            console.error('User not found for webhook:', userId);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (status === 'approved') {
            const faceHash = result?.face?.hash || hashString(result?.face?.data || session_id);
            const documentHash = result?.document?.hash || hashString(result?.document?.data || session_id);
            const country = result?.country || null;
            const fullName = result?.full_name || user.name || null;

            const existingFace = await prisma.identityIndex.findUnique({
                where: { id: faceHash }
            });
            const existingDoc = await prisma.identityIndex.findUnique({
                where: { id: documentHash }
            });

            if (existingFace || existingDoc) {
                const duplicateType = [];
                if (existingFace) duplicateType.push('FACE');
                if (existingDoc) duplicateType.push('DOCUMENT');

                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        verificationStatus: 'REJECTED',
                        duplicateDetected: true,
                        suspiciousVerification: true,
                        lastVerificationResult: {
                            status: status,
                            rejectedAt: new Date().toISOString(),
                            reason: 'DUPLICATE_IDENTITY'
                        }
                    }
                });

                return NextResponse.json({
                    success: true,
                    message: 'Duplicate identity detected',
                    duplicate: true
                });
            }

            await prisma.identityIndex.create({
                data: {
                    id: faceHash,
                    userId: userId,
                    type: 'FACE'
                }
            });

            await prisma.identityIndex.create({
                data: {
                    id: documentHash,
                    userId: userId,
                    type: 'DOCUMENT'
                }
            });

            await prisma.user.update({
                where: { id: userId },
                data: {
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
                        approvedAt: new Date().toISOString(),
                        fullName: fullName,
                        country: country
                    }
                }
            });

            return NextResponse.json({
                success: true,
                message: 'Verification approved',
                verified: true
            });

        } else if (status === 'declined' || status === 'rejected') {
            const rejectionReason = result?.reason || 'Unknown reason';

            await prisma.user.update({
                where: { id: userId },
                data: {
                    verificationStatus: 'REJECTED',
                    lastVerificationResult: {
                        status: status,
                        rejectedAt: new Date().toISOString(),
                        reason: rejectionReason
                    }
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