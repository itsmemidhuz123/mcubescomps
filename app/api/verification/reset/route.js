export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { updateVerificationStatus } from '@/lib/firebase-admin';

export async function POST(request) {
    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        console.log('Reset verification for userId:', userId);

        const result = await updateVerificationStatus(userId, {
            verificationStatus: 'UNVERIFIED',
            diditSessionId: null,
            diditWorkflowId: null,
            lastVerificationAttemptAt: null,
            lastVerificationResult: null
        });

        if (result.error) {
            console.error('Reset error:', result.error);
            return NextResponse.json({ error: 'Failed to reset' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Reset error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}