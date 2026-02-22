export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        console.log('Status API - fetching for userId:', userId);

        const supabase = getSupabaseAdmin();

        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        console.log('Status API - userData:', userData);
        console.log('Status API - verification_status:', userData?.verification_status);
        console.log('Status API - verificationstatus:', userData?.verificationstatus);

        if (userError) {
            console.error('Status API - error:', userError);
        }

        if (userError || !userData) {
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

        // Check both snake_case and camelCase column names for backward compatibility
        const verificationStatus = userData.verification_status || userData.verificationstatus || 'UNVERIFIED';
        const verifiedAt = userData.verified_at || userData.verifiedat || null;
        const verificationLevel = userData.verification_level || userData.verificationlevel || null;
        const duplicateDetected = userData.duplicate_detected || userData.duplicatedetected || false;
        const suspiciousVerification = userData.suspicious_verification || userData.suspiciousverification || false;
        const verificationAttemptCount = userData.verification_attempt_count || userData.verificationattemptcount || 0;
        const lastVerificationResult = userData.last_verification_result || userData.lastverificationresult || null;
        const lastVerificationAttemptAt = userData.last_verification_attempt_at || userData.lastverificationattemptat || null;

        const response = {
            verificationStatus: verificationStatus,
            verifiedAt: verifiedAt,
            verificationLevel: verificationLevel,
            duplicateDetected: duplicateDetected,
            suspiciousVerification: suspiciousVerification,
            verificationAttemptCount: verificationAttemptCount,
            lastVerificationResult: lastVerificationResult,
            lastVerificationAttemptAt: lastVerificationAttemptAt
        };

        console.log('Status API - returning:', response);

        return NextResponse.json(response);

    } catch (error) {
        console.error('Verification status error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}