export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request) {
    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        const { error } = await supabase
            .from('users')
            .update({
                verificationstatus: 'UNVERIFIED',
                diditsessionid: null,
                diditworkflowid: null,
                lastverificationattemptat: null
            })
            .eq('id', userId);

        if (error) {
            console.error('Reset error:', error);
            return NextResponse.json({ error: 'Failed to reset' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Reset error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}