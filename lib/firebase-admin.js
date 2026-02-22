import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let firestore = null;

function getFirestoreClient() {
    if (firestore) return firestore;

    try {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

        if (!projectId || !clientEmail || !privateKeyRaw) {
            console.log('Firebase Admin env vars not configured');
            return null;
        }

        const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

        if (getApps().length === 0) {
            initializeApp({
                credential: cert({ projectId, clientEmail, privateKey })
            });
        }

        firestore = getFirestore();
        return firestore;
    } catch (error) {
        console.error('Firebase Admin init error:', error.message);
        return null;
    }
}

export async function getVerificationData(userId) {
    const db = getFirestoreClient();
    if (!db) return null;

    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) return null;
        return userDoc.data();
    } catch (error) {
        console.error('Error fetching verification data:', error.message);
        return null;
    }
}

export async function updateVerificationStatus(userId, data) {
    const db = getFirestoreClient();
    if (!db) return { error: 'Firebase not configured' };

    try {
        await db.collection('users').doc(userId).set(data, { merge: true });
        return { success: true };
    } catch (error) {
        console.error('Error updating verification data:', error.message);
        return { error: error.message };
    }
}

export async function getAllUsersWithVerification(limit = 100) {
    const db = getFirestoreClient();
    if (!db) return { error: 'Firebase not configured', users: [] };

    try {
        const usersSnapshot = await db.collection('users')
            .orderBy('verificationRequestedAt', 'desc')
            .limit(limit)
            .get();

        const users = [];
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.verificationStatus && ['PENDING', 'VERIFIED', 'REJECTED'].includes(data.verificationStatus)) {
                users.push({
                    uid: doc.id,
                    ...data
                });
            }
        });

        return { users };
    } catch (error) {
        console.error('Error fetching users with verification:', error.message);
        return { error: error.message, users: [] };
    }
}

export async function getAllUsers(limit = 100) {
    const db = getFirestoreClient();
    if (!db) return { error: 'Firebase not configured', users: [] };

    try {
        const usersSnapshot = await db.collection('users')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        const users = [];
        usersSnapshot.forEach(doc => {
            users.push({
                uid: doc.id,
                ...doc.data()
            });
        });

        return { users };
    } catch (error) {
        console.error('Error fetching users:', error.message);
        return { error: error.message, users: [] };
    }
}

export async function getUserByDiditSession(diditSessionId) {
    const db = getFirestoreClient();
    if (!db) return null;

    try {
        const usersSnapshot = await db.collection('users')
            .where('diditSessionId', '==', diditSessionId)
            .limit(1)
            .get();

        if (usersSnapshot.empty) return null;

        const doc = usersSnapshot.docs[0];
        return {
            uid: doc.id,
            ...doc.data()
        };
    } catch (error) {
        console.error('Error finding user by diditSessionId:', error.message);
        return null;
    }
}

export async function updateVerificationStatusWithCheck(userId, data) {
    const db = getFirestoreClient();
    if (!db) return { error: 'Firebase not configured' };

    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const currentData = userDoc.exists ? userDoc.data() : {};
        const currentStatus = currentData.verificationStatus;

        if (currentStatus === 'VERIFIED' && data.verificationStatus !== 'VERIFIED') {
            console.log(`Skipping status update for ${userId}: already VERIFIED`);
            return { success: true, skipped: true, reason: 'already_verified' };
        }

        if (currentStatus === 'BLOCKED' && !data.unblock) {
            console.log(`Skipping status update for ${userId}: user is BLOCKED`);
            return { success: true, skipped: true, reason: 'user_blocked' };
        }

        await db.collection('users').doc(userId).set(data, { merge: true });
        return { success: true };
    } catch (error) {
        console.error('Error updating verification data:', error.message);
        return { error: error.message };
    }
}

export default getFirestoreClient;