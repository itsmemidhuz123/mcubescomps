export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            verificationStatus: userData.verificationstatus || 'UNVERIFIED',
            verifiedAt: userData.verifiedat || null,
            verificationLevel: userData.verificationlevel || null,
            duplicateDetected: userData.duplicatedetected || false,
            suspiciousVerification: userData.suspiciousverification || false,
            verificationAttemptCount: userData.verificationattemptcount || 0,
            lastVerificationResult: userData.lastverificationresult || null
        });

    } catch (error) {
        console.error('Verification status error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}