export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getVerificationData, updateVerificationStatus } from '@/lib/firebase-admin';

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
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        console.log('Check DIDIT status for userId:', userId);

        const userData = await getVerificationData(userId);

        if (!userData) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const diditSessionId = userData.diditSessionId;

        if (!diditSessionId) {
            return NextResponse.json({
                needsVerification: true,
                message: 'No DIDIT session found'
            });
        }

        const currentStatus = userData.verificationStatus;

        if (currentStatus === 'VERIFIED') {
            return NextResponse.json({
                status: 'VERIFIED',
                verified: true,
                needsVerification: false,
                message: 'Already verified'
            });
        }

        const diditApiKey = process.env.DIDIT_API_KEY;

        if (!diditApiKey) {
            return NextResponse.json({ error: 'DIDIT not configured' }, { status: 500 });
        }

        console.log('Querying DIDIT for session:', diditSessionId);

        let sessionData = null;
        let diditStatus = null;
        let diditError = null;

        try {
            const sessionResponse = await fetch(`https://verification.didit.me/v3/session/${diditSessionId}/`, {
                method: 'GET',
                headers: {
                    'x-api-key': diditApiKey,
                    'Content-Type': 'application/json'
                }
            });

            if (sessionResponse.ok) {
                sessionData = await sessionResponse.json();
                console.log('DIDIT session response:', JSON.stringify(sessionData));
                diditStatus = sessionData.status || sessionData.result?.status;
            } else {
                const errorText = await sessionResponse.text();
                console.log('DIDIT session query response:', sessionResponse.status, errorText);
                diditError = errorText;
            }
        } catch (e) {
            console.log('DIDIT session query error:', e.message);
            diditError = e.message;
        }

        if (!diditStatus && diditError) {
            return NextResponse.json({
                status: currentStatus || 'PENDING',
                verified: currentStatus === 'VERIFIED',
                needsVerification: currentStatus !== 'VERIFIED',
                message: 'Could not verify with DIDIT. Status unchanged.',
                diditError: diditError,
                retryAfter: 60 * 1000
            });
        }

        const mappedStatus = mapDiditStatus(diditStatus);

        console.log('DIDIT status:', diditStatus, '-> mapped:', mappedStatus);

        if (mappedStatus === 'VERIFIED') {
            const updateData = {
                verificationStatus: 'VERIFIED',
                verifiedAt: new Date().toISOString(),
                verificationLevel: 1,
                duplicateDetected: sessionData.result?.duplicate_detected || false,
                suspiciousVerification: false,
                lastVerificationResult: {
                    status: diditStatus,
                    approvedAt: new Date().toISOString()
                }
            };

            await updateVerificationStatus(userId, updateData);

            return NextResponse.json({
                status: 'VERIFIED',
                verified: true,
                needsVerification: false,
                message: 'Verification approved'
            });

        } else if (mappedStatus === 'REJECTED') {
            const rejectionReason = sessionData.result?.reason || 'Verification was declined';

            const updateData = {
                verificationStatus: 'REJECTED',
                lastVerificationResult: {
                    status: diditStatus,
                    rejectedAt: new Date().toISOString(),
                    reason: rejectionReason
                }
            };

            await updateVerificationStatus(userId, updateData);

            return NextResponse.json({
                status: 'REJECTED',
                verified: false,
                needsVerification: true,
                message: rejectionReason,
                retryAfter: 24 * 60 * 60 * 1000
            });

        } else if (mappedStatus === 'PENDING') {
            return NextResponse.json({
                status: 'PENDING',
                verified: false,
                needsVerification: true,
                message: 'Verification still in progress',
                retryAfter: 60 * 1000
            });
        }

        return NextResponse.json({
            status: mappedStatus,
            verified: mappedStatus === 'VERIFIED',
            needsVerification: mappedStatus !== 'VERIFIED',
            currentStatus: currentStatus
        });

    } catch (error) {
        console.error('Check status error:', error.message);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}