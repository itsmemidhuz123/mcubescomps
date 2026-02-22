export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

let adminApp = null;
let adminDb = null;

function parsePrivateKey(privateKey) {
    if (!privateKey) return null;
    if (privateKey.includes('\n') && !privateKey.includes('\\n')) {
        return privateKey;
    }
    return privateKey.replace(/\\n/g, '\n');
}

async function initializeAdmin() {
    if (adminDb) return adminDb;

    try {
        const { initializeApp, getApps, cert } = await import('firebase-admin/app');
        const { getFirestore } = await import('firebase-admin/firestore');

        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

        if (!projectId || !clientEmail || !privateKeyRaw) {
            console.error('Missing Firebase Admin env vars');
            throw new Error('Missing Firebase environment variables');
        }

        const privateKey = parsePrivateKey(privateKeyRaw);

        if (!adminApp) {
            if (getApps().length === 0) {
                adminApp = initializeApp({
                    credential: cert({
                        projectId,
                        clientEmail,
                        privateKey
                    })
                });
            } else {
                adminApp = getApps()[0];
            }
        }

        adminDb = getFirestore(adminApp);
        return adminDb;
    } catch (error) {
        console.error('Firebase Admin init error:', error.message);
        throw error;
    }
}

export async function GET(request) {
    try {
        const db = await initializeAdmin();

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();

        return NextResponse.json({
            verificationStatus: userData.verificationStatus || 'UNVERIFIED',
            verifiedAt: userData.verifiedAt || null,
            verificationLevel: userData.verificationLevel || null,
            duplicateDetected: userData.duplicateDetected || false,
            suspiciousVerification: userData.suspiciousVerification || false,
            verificationAttemptCount: userData.verificationAttemptCount || 0,
            lastVerificationResult: userData.lastVerificationResult || null
        });

    } catch (error) {
        console.error('Verification status error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}