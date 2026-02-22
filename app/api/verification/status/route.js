export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

let prisma = null;

async function getPrisma() {
    if (prisma) return prisma;
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
    return prisma;
}

export async function GET(request) {
    try {
        const db = await getPrisma();
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        const user = await db.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
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