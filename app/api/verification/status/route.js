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

        const supabase = getSupabaseAdmin();

        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

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

        return NextResponse.json({
            verificationStatus: userData.verification_status || 'UNVERIFIED',
            verifiedAt: userData.verified_at || null,
            verificationLevel: userData.verification_level || null,
            duplicateDetected: userData.duplicate_detected || false,
            suspiciousVerification: userData.suspicious_verification || false,
            verificationAttemptCount: userData.verification_attempt_count || 0,
            lastVerificationResult: userData.last_verification_result || null,
            lastVerificationAttemptAt: userData.last_verification_attempt_at || null
        });

    } catch (error) {
        console.error('Verification status error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}