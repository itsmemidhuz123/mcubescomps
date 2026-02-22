export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

let supabase = null;

function getSupabase() {
    if (supabase) return supabase;
    supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY
    );
    return supabase;
}

export async function GET(request) {
    try {
        const sb = getSupabase();
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        const { data: user, error } = await sb
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            verificationStatus: user.verificationStatus || 'UNVERIFIED',
            verifiedAt: user.verifiedAt || null,
            verificationLevel: user.verificationLevel || null,
            duplicateDetected: user.duplicateDetected || false,
            suspiciousVerification: user.suspiciousVerification || false,
            verificationAttemptCount: user.verificationAttemptCount || 0,
            lastVerificationResult: user.lastVerificationResult || null
        });

    } catch (error) {
        console.error('Verification status error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}