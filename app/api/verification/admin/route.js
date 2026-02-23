export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getVerificationData, updateVerificationStatus } from '@/lib/firebase-admin';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

async function logVerificationEvent(userId, eventType, details) {
    try {
        const logRef = doc(db, 'auditLogs', `${eventType}_${userId}_${Date.now()}`);
        await setDoc(logRef, {
            eventType,
            userId,
            details,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Failed to log verification event:', error.message);
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, action, reason, adminUserId } = body;
        const authHeader = request.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        if (!userId || !action) {
            return NextResponse.json({ error: 'User ID and action required' }, { status: 400 });
        }

        console.log('Admin verification action:', action, 'for user:', userId);

        if (action === 'manual_verify') {
            const userData = await getVerificationData(userId);
            const previousStatus = userData?.verificationStatus || 'UNKNOWN';

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
            await logVerificationEvent(userId, 'verification_override', {
                action: 'manual_verify',
                previousStatus,
                newStatus: 'VERIFIED',
                adminUserId,
                timestamp: new Date().toISOString()
            });

            return NextResponse.json({
                success: true,
                message: 'User manually verified',
                verificationStatus: 'VERIFIED'
            });

        } else if (action === 'manual_reject') {
            const userData = await getVerificationData(userId);
            const attemptCount = (userData?.verificationAttemptCount || 0) + 1;
            const newStatus = attemptCount >= 3 ? 'BLOCKED' : 'REJECTED';
            const previousStatus = userData?.verificationStatus || 'UNKNOWN';

            const updateData = {
                verificationStatus: newStatus,
                verificationAttemptCount: attemptCount,
                lastVerificationAttemptAt: new Date().toISOString(),
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

            console.log('User manually rejected:', userId, 'status:', newStatus);
            await logVerificationEvent(userId, 'verification_override', {
                action: 'manual_reject',
                previousStatus,
                newStatus,
                attemptCount,
                reason: reason || 'Manually rejected by admin',
                adminUserId,
                timestamp: new Date().toISOString()
            });

            return NextResponse.json({
                success: true,
                message: newStatus === 'BLOCKED' ? 'User blocked (max attempts)' : 'User manually rejected',
                verificationStatus: newStatus
            });

        } else if (action === 'reset') {
            const userData = await getVerificationData(userId);
            const previousStatus = userData?.verificationStatus || 'UNKNOWN';

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
                verificationRequestedAt: null,
                verificationAttemptCount: 0
            };

            const result = await updateVerificationStatus(userId, updateData);

            if (result.error) {
                return NextResponse.json({ error: result.error }, { status: 500 });
            }

            console.log('User verification reset:', userId);
            await logVerificationEvent(userId, 'verification_reset', {
                action: 'reset',
                previousStatus,
                newStatus: 'UNVERIFIED',
                adminUserId,
                timestamp: new Date().toISOString()
            });

            return NextResponse.json({
                success: true,
                message: 'Verification status reset',
                verificationStatus: 'UNVERIFIED'
            });

        } else if (action === 'unlock') {
            const userData = await getVerificationData(userId);

            if (userData?.verificationStatus !== 'BLOCKED') {
                return NextResponse.json({
                    error: 'User is not blocked'
                }, { status: 400 });
            }

            const previousStatus = userData.verificationStatus;

            const updateData = {
                verificationStatus: 'UNVERIFIED',
                suspiciousVerification: false,
                lastVerificationResult: {
                    status: 'unblocked',
                    unlockedAt: new Date().toISOString(),
                    unlockedBy: 'admin'
                },
                verificationAttemptCount: 0
            };

            const result = await updateVerificationStatus(userId, updateData);

            if (result.error) {
                return NextResponse.json({ error: result.error }, { status: 500 });
            }

            console.log('User unlocked:', userId);
            await logVerificationEvent(userId, 'verification_override', {
                action: 'unlock',
                previousStatus,
                newStatus: 'UNVERIFIED',
                adminUserId,
                timestamp: new Date().toISOString()
            });

            return NextResponse.json({
                success: true,
                message: 'User verification unlocked',
                verificationStatus: 'UNVERIFIED'
            });

        } else if (action === 'reset_attempts') {
            const previousCount = (await getVerificationData(userId))?.verificationAttemptCount || 0;

            const updateData = {
                verificationAttemptCount: 0,
                lastVerificationResult: {
                    status: 'attempts_reset',
                    resetAt: new Date().toISOString(),
                    resetBy: 'admin'
                }
            };

            const result = await updateVerificationStatus(userId, updateData);

            if (result.error) {
                return NextResponse.json({ error: result.error }, { status: 500 });
            }

            console.log('User attempts reset:', userId);
            await logVerificationEvent(userId, 'verification_override', {
                action: 'reset_attempts',
                previousAttemptCount: previousCount,
                newAttemptCount: 0,
                adminUserId,
                timestamp: new Date().toISOString()
            });

            return NextResponse.json({
                success: true,
                message: 'Verification attempts reset',
                verificationAttemptCount: 0
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

        const lastResult = userData.lastVerificationResult;
        let cooldownExpiry = null;

        if (userData.verificationStatus === 'REJECTED' && lastResult?.rejectedAt) {
            const rejectedAt = new Date(lastResult.rejectedAt);
            const cooldownEnd = new Date(rejectedAt.getTime() + 24 * 60 * 60 * 1000);
            if (cooldownEnd > new Date()) {
                cooldownExpiry = cooldownEnd.toISOString();
            }
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
            verificationRequestedAt: userData.verificationRequestedAt || null,
            cooldownExpiry
        });

    } catch (error) {
        console.error('Get user verification error:', error.message);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}