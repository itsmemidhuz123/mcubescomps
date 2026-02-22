export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getVerificationData } from '@/lib/firebase-admin';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        console.log('Status API - fetching for userId:', userId);

        const userData = await getVerificationData(userId);

        console.log('Status API - userData:', userData);

        if (!userData) {
            return NextResponse.json({
                verificationStatus: 'UNVERIFIED',
                verifiedAt: null,
                verificationLevel: null,
                duplicateDetected: false,
                suspiciousVerification: false,
                verificationAttemptCount: 0,
                lastVerificationResult: null,
                lastVerificationAttemptAt: null
            });
        }

        const response = {
            verificationStatus: userData.verificationStatus || 'UNVERIFIED',
            verifiedAt: userData.verifiedAt || null,
            verificationLevel: userData.verificationLevel || null,
            duplicateDetected: userData.duplicateDetected || false,
            suspiciousVerification: userData.suspiciousVerification || false,
            verificationAttemptCount: userData.verificationAttemptCount || 0,
            lastVerificationResult: userData.lastVerificationResult || null,
            lastVerificationAttemptAt: userData.lastVerificationAttemptAt || null
        };

        console.log('Status API - returning:', response);

        return NextResponse.json(response);

    } catch (error) {
        console.error('Verification status error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}