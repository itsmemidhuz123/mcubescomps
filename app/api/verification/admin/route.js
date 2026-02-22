export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getVerificationData, updateVerificationStatus } from '@/lib/firebase-admin';

export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, action, reason } = body;
        const authHeader = request.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        if (!userId || !action) {
            return NextResponse.json({ error: 'User ID and action required' }, { status: 400 });
        }

        console.log('Admin verification action:', action, 'for user:', userId);

        if (action === 'manual_verify') {
            const updateData = {
                verificationStatus: 'VERIFIED',
                verifiedAt: new Date().toISOString(),
                verificationLevel: 1,
                duplicateDetected: false,
                suspiciousVerification: false,
                lastVerificationResult: {
                    status: 'approved',
                    approvedAt: new Date().toISOString(),
                    manuallyApprovedBy: 'admin'
                }
            };

            const result = await updateVerificationStatus(userId, updateData);

            if (result.error) {
                return NextResponse.json({ error: result.error }, { status: 500 });
            }

            console.log('User manually verified:', userId);

            return NextResponse.json({
                success: true,
                message: 'User manually verified',
                verificationStatus: 'VERIFIED'
            });

        } else if (action === 'manual_reject') {
            const updateData = {
                verificationStatus: 'REJECTED',
                lastVerificationResult: {
                    status: 'rejected',
                    rejectedAt: new Date().toISOString(),
                    reason: reason || 'Manually rejected by admin',
                    manuallyRejectedBy: 'admin'
                }
            };

            const result = await updateVerificationStatus(userId, updateData);

            if (result.error) {
                return NextResponse.json({ error: result.error }, { status: 500 });
            }

            console.log('User manually rejected:', userId);

            return NextResponse.json({
                success: true,
                message: 'User manually rejected',
                verificationStatus: 'REJECTED'
            });

        } else if (action === 'reset') {
            const userData = await getVerificationData(userId);

            const currentAttemptCount = userData?.verificationAttemptCount || 0;

            const updateData = {
                verificationStatus: 'UNVERIFIED',
                verifiedAt: null,
                verificationLevel: null,
                duplicateDetected: false,
                suspiciousVerification: false,
                diditSessionId: null,
                currentSessionId: null,
                lastVerificationResult: null,
                lastVerificationAttemptAt: null,
                verificationRequestedAt: null
            };

            const result = await updateVerificationStatus(userId, updateData);

            if (result.error) {
                return NextResponse.json({ error: result.error }, { status: 500 });
            }

            console.log('User verification reset:', userId);

            return NextResponse.json({
                success: true,
                message: 'Verification status reset',
                verificationStatus: 'UNVERIFIED'
            });

        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        console.error('Admin verification error:', error.message);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        const userData = await getVerificationData(userId);

        if (!userData) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            uid: userId,
            verificationStatus: userData.verificationStatus || 'UNVERIFIED',
            verifiedAt: userData.verifiedAt || null,
            verificationLevel: userData.verificationLevel || null,
            duplicateDetected: userData.duplicateDetected || false,
            suspiciousVerification: userData.suspiciousVerification || false,
            verificationAttemptCount: userData.verificationAttemptCount || 0,
            diditSessionId: userData.diditSessionId || null,
            lastVerificationResult: userData.lastVerificationResult || null,
            lastVerificationAttemptAt: userData.lastVerificationAttemptAt || null,
            verificationRequestedAt: userData.verificationRequestedAt || null
        });

    } catch (error) {
        console.error('Get user verification error:', error.message);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}