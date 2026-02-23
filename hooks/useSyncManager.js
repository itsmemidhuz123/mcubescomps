import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { getAllSessions } from '@/lib/indexedDB';

const SYNC_STATUS = {
    SYNCED: 'synced',
    NOT_SYNCED: 'not_synced',
    SYNCING: 'syncing',
    ERROR: 'error'
};

export const useSyncManager = () => {
    const { user } = useAuth();
    const [syncStatus, setSyncStatus] = useState(SYNC_STATUS.NOT_SYNCED);
    const [hasLocalData, setHasLocalData] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState(null);
    const [showMergePrompt, setShowMergePrompt] = useState(false);

    useEffect(() => {
        checkLocalData();
    }, []);

    useEffect(() => {
        if (user) {
            checkRemoteData();
        }
    }, [user]);

    const checkLocalData = async () => {
        try {
            const sessions = await getAllSessions();
            const hasData = sessions && sessions.length > 0;
            setHasLocalData(hasData);

            if (hasData && !user) {
                setSyncStatus(SYNC_STATUS.NOT_SYNCED);
            }
        } catch (error) {
            console.error('Error checking local data:', error);
        }
    };

    const checkRemoteData = async () => {
        if (!user) return;

        try {
            const sessionsRef = collection(db, 'timerSessions');
            const q = query(sessionsRef, where('userId', '==', user.uid));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                setSyncStatus(SYNC_STATUS.NOT_SYNCED);
            } else if (hasLocalData) {
                setShowMergePrompt(true);
            } else {
                setSyncStatus(SYNC_STATUS.SYNCED);
            }
        } catch (error) {
            console.error('Error checking remote data:', error);
            if (hasLocalData) {
                setShowMergePrompt(true);
            }
        }
    };

    const syncSession = async (session) => {
        if (!user) return null;

        try {
            setSyncStatus(SYNC_STATUS.SYNCING);

            const sessionRef = doc(db, 'timerSessions', session.sessionId);
            await setDoc(sessionRef, {
                ...session,
                userId: user.uid,
                syncedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });

            setSyncStatus(SYNC_STATUS.SYNCED);
            setLastSyncedAt(Date.now());

            return true;
        } catch (error) {
            console.error('Error syncing session:', error);
            setSyncStatus(SYNC_STATUS.ERROR);
            return false;
        }
    };

    const syncAllSessions = async () => {
        if (!user) return { success: 0, failed: 0 };

        try {
            setSyncStatus(SYNC_STATUS.SYNCING);

            const localSessions = await getAllSessions();
            let success = 0;
            let failed = 0;

            for (const session of localSessions) {
                const sessionRef = doc(db, 'timerSessions', session.sessionId);
                try {
                    await setDoc(sessionRef, {
                        ...session,
                        userId: user.uid,
                        syncedAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    }, { merge: true });
                    success++;
                } catch (err) {
                    failed++;
                    console.error('Failed to sync session:', session.sessionId, err);
                }
            }

            setSyncStatus(success > 0 ? SYNC_STATUS.SYNCED : SYNC_STATUS.ERROR);
            setLastSyncedAt(Date.now());

            return { success, failed };
        } catch (error) {
            console.error('Error syncing all sessions:', error);
            setSyncStatus(SYNC_STATUS.ERROR);
            return { success: 0, failed: 0 };
        }
    };

    const loadRemoteSessions = async () => {
        if (!user) return [];

        try {
            const sessionsRef = collection(db, 'timerSessions');
            const q = query(sessionsRef, where('userId', '==', user.uid));
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error loading remote sessions:', error);
            return [];
        }
    };

    const mergeData = async (strategy = 'merge') => {
        if (!user) return { success: false, message: 'Not authenticated' };

        try {
            setSyncStatus(SYNC_STATUS.SYNCING);

            if (strategy === 'merge') {
                const localSessions = await getAllSessions();

                for (const session of localSessions) {
                    const sessionRef = doc(db, 'timerSessions', session.sessionId);
                    const existingDoc = await getDoc(sessionRef);

                    if (existingDoc.exists()) {
                        const existingData = existingDoc.data();
                        const mergedSolves = [...(existingData.solves || []), ...(session.solves || [])];

                        await setDoc(sessionRef, {
                            ...session,
                            solves: mergedSolves,
                            userId: user.uid,
                            mergedAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                        }, { merge: true });
                    } else {
                        await setDoc(sessionRef, {
                            ...session,
                            userId: user.uid,
                            mergedAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                        });
                    }
                }

                setSyncStatus(SYNC_STATUS.SYNCED);
                setShowMergePrompt(false);
                return { success: true, message: 'Data merged successfully' };
            } else if (strategy === 'remote') {
                setSyncStatus(SYNC_STATUS.SYNCED);
                setShowMergePrompt(false);
                return { success: true, message: 'Using cloud data' };
            } else {
                setSyncStatus(SYNC_STATUS.SYNCED);
                setShowMergePrompt(false);
                return { success: true, message: 'Local data kept' };
            }
        } catch (error) {
            console.error('Error merging data:', error);
            setSyncStatus(SYNC_STATUS.ERROR);
            return { success: false, message: error.message };
        }
    };

    return {
        syncStatus,
        hasLocalData,
        lastSyncedAt,
        showMergePrompt,
        setShowMergePrompt,
        syncSession,
        syncAllSessions,
        loadRemoteSessions,
        mergeData,
        checkLocalData,
        checkRemoteData
    };
};

export { SYNC_STATUS };