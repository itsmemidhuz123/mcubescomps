export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        let whereClause = {};
        if (status && status !== 'ALL') {
            whereClause.verificationStatus = status;
        }

        const users = await prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                email: true,
                name: true,
                picture: true,
                verificationStatus: true,
                verifiedAt: true,
                verificationAttemptCount: true,
                duplicateDetected: true,
                suspiciousVerification: true,
                createdAt: true
            },
            orderBy: {
                verifiedAt: 'desc'
            },
            take: 100
        });

        return NextResponse.json({ users });

    } catch (error) {
        console.error('Verification admin data error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { action, userId } = await request.json();

        if (action === 'force_reverify') {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    verificationStatus: null,
                    diditSessionId: null,
                    faceHash: null,
                    documentHash: null,
                    duplicateDetected: false,
                    suspiciousVerification: false,
                    lastVerificationResult: null
                }
            });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

    } catch (error) {
        console.error('Verification admin action error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}