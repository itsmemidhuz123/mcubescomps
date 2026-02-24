'use client';

import { doc, setDoc, getDoc, writeBatch, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAllSessions, generateSolveHash } from '@/lib/indexedDB';

const SESSIONS_COLLECTION = 'timerSessions';

export const SYNC_STATUS = {
    UNSYNCED: 'unsynced',
    SYNCING: 'syncing',
    SYNCED: 'synced',
    ERROR: 'error',
    DISABLED: 'disabled'
};

// Session documents live under: /users/{userId}/timerSessions/{sessionId}
export const getTimerSessionDoc = (userId, sessionId) => {
    return doc(db, 'users', userId, 'timerSessions', sessionId);
};

export const getLocalSolvesHashes = async () => {
    const sessions = await getAllSessions();
    const hashes = new Set();

    sessions.forEach(session => {
        if (session.solves) {
            session.solves.forEach(solve => {
                if (solve.hash) {
                    hashes.add(solve.hash);
                }
            });
        }
    });

    return hashes;
};

export const getRemoteHashes = async (userId) => {
    const sessionsRef = collection(db, 'users', userId, 'timerSessions');
    const snapshot = await getDocs(sessionsRef);
    const hashes = new Set();

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.solves) {
            data.solves.forEach(solve => {
                if (solve.hash) {
                    hashes.add(solve.hash);
                }
            });
        }
    });

    return hashes;
};

export const syncTimerData = async (userId, onProgress) => {
    if (!userId) {
        throw new Error('User not authenticated');
    }

    const localSessions = await getAllSessions();
    const remoteHashes = await getRemoteHashes(userId);

    const sessionsToUpload = [];
    let totalSolves = 0;
    let syncedSolves = 0;

    localSessions.forEach(session => {
        const solves = session.solves || [];
        const uniqueSolves = solves.filter(solve => {
            const hash = solve.hash || generateSolveHash(session.eventId, solve.time, solve.createdAt);
            return !remoteHashes.has(hash);
        });

        if (uniqueSolves.length > 0 || !remoteHashes.size) {
            totalSolves += uniqueSolves.length;
            sessionsToUpload.push({
                ...session,
                solves: uniqueSolves.map(solve => ({
                    ...solve,
                    hash: solve.hash || generateSolveHash(session.eventId, solve.time, solve.createdAt)
                }))
            });
        }
    });

    if (sessionsToUpload.length === 0) {
        // Update lastSynced at user level for a lightweight indicator
        await setDoc(doc(db, 'users', userId), {
            lastSyncedAt: serverTimestamp()
        }, { merge: true });

        return { synced: 0, total: totalSolves, sessions: 0 };
    }

    const batch = writeBatch(db);
    const maxBatchSize = 450;
    let batchCount = 0;

    for (const session of sessionsToUpload) {
        const sessionRef = getTimerSessionDoc(userId, session.sessionId);
        batch.set(sessionRef, {
            ...session,
            userId,
            syncedAt: serverTimestamp()
        }, { merge: true });

        syncedSolves += session.solves.length;
        batchCount++;

        if (batchCount >= maxBatchSize) {
            await batch.commit();
            if (onProgress) onProgress({ synced: syncedSolves, total: totalSolves });
            batchCount = 0;
        }
    }

    if (batchCount > 0) {
        await batch.commit();
    }

    await setDoc(doc(db, 'users', userId), {
        lastSyncedAt: serverTimestamp()
    }, { merge: true });

    return { synced: syncedSolves, total: totalSolves, sessions: sessionsToUpload.length };
};

export const loadTimerDataFromCloud = async (userId) => {
    if (!userId) return null;
    const sessionsRef = collection(db, 'users', userId, 'timerSessions');
    const snapshot = await getDocs(sessionsRef);
    const sessions = [];
    snapshot.forEach(docSnap => {
        sessions.push({ id: docSnap.id, ...docSnap.data() });
    });
    return { sessions };
};

export const disableSync = async (userId) => {
    if (!userId) return;
    await setDoc(doc(db, 'users', userId), {
        syncEnabled: false,
        lastSyncedAt: serverTimestamp()
    }, { merge: true });
};

export const enableSync = async (userId) => {
    if (!userId) return;
    await setDoc(doc(db, 'users', userId), {
        syncEnabled: true,
        lastSyncedAt: serverTimestamp()
    }, { merge: true });
};