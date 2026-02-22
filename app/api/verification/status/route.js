import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBUH2hL2lR-nNi2jnWQWeeX00z8N-MQqO0",
    authDomain: "texcads-670e0.firebaseapp.com",
    databaseURL: "https://texcads-670e0-default-rtdb.firebaseio.com",
    projectId: "texcads-670e0",
    storageBucket: "texcads-670e0.firebasestorage.app",
    messagingSenderId: "586899233238",
    appId: "1:586899233238:web:9dbee74e14cd95f23f2c77"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        const userDoc = await getDoc(doc(db, 'users', userId));

        if (!userDoc.exists()) {
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