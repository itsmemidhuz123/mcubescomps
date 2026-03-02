import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    saveSession,
    getSession,
    getLatestSession,
    getSessionsByEvent,
    getAllSessions,
    deleteSession as deleteSessionFromDB,
    generateSessionId,
    generateSolveHash,
    updateSessionName
} from '@/lib/indexedDB';
import { syncTimerData, SYNC_STATUS } from '@/lib/sync';
import { calculateAllStats } from '@/lib/timerStats';
import { DEFAULT_EVENT } from '@/lib/events';

export const useSessionManager = () => {
    const { user } = useAuth();
    const [currentEvent, setCurrentEvent] = useState(DEFAULT_EVENT.id);
    const [currentSession, setCurrentSession] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [solves, setSolves] = useState([]);
    const [stats, setStats] = useState({
        bestSingle: null,
        ao5: null,
        ao12: null,
        ao50: null,
        ao100: null,
        totalSolves: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState(SYNC_STATUS.UNSYNCED);
    const syncIntervalRef = useRef(null);
    const lastSyncRef = useRef(0);

    const createNewSession = useCallback(async (eventId) => {
        const newSession = {
            sessionId: generateSessionId(),
            userId: user?.uid || null,
            eventId,
            solves: [],
            bestSingle: null,
            ao5: null,
            ao12: null,
            ao50: null,
            ao100: null,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        await saveSession(newSession);
        setCurrentSession(newSession);
        setSolves([]);
        setStats({
            bestSingle: null,
            ao5: null,
            ao12: null,
            ao50: null,
            ao100: null,
            totalSolves: 0
        });

        return newSession;
    }, [user]);

    const loadLatestSession = useCallback(async (eventId) => {
        setIsLoading(true);
        try {
            const latestSession = await getLatestSession(eventId);

            if (latestSession) {
                setCurrentSession(latestSession);
                setSolves(latestSession.solves || []);
                setStats(calculateAllStats(latestSession.solves || []));
            } else {
                await createNewSession(eventId);
            }
        } catch (error) {
            console.error('Error loading session:', error);
            await createNewSession(eventId);
        }
        setIsLoading(false);
    }, [createNewSession]);

    const loadSessionsForEvent = useCallback(async (eventId) => {
        try {
            const eventSessions = await getSessionsByEvent(eventId);
            setSessions(eventSessions);
        } catch (error) {
            console.error('Error loading sessions:', error);
        }
    }, []);

    const switchEvent = useCallback(async (eventId) => {
        setCurrentEvent(eventId);
        await loadLatestSession(eventId);
        await loadSessionsForEvent(eventId);
    }, [loadLatestSession, loadSessionsForEvent]);

    const addSolve = useCallback(async (solve) => {
        if (!currentSession) return;

        const createdAt = solve.createdAt || Date.now();
        const hash = generateSolveHash(currentSession.eventId, solve.time, createdAt);

        const newSolve = {
            ...solve,
            id: `solve_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt,
            hash
        };

        const updatedSolves = [newSolve, ...solves];
        const newStats = calculateAllStats(updatedSolves);

        const updatedSession = {
            ...currentSession,
            solves: updatedSolves,
            bestSingle: newStats.bestSingle,
            ao5: newStats.ao5,
            ao12: newStats.ao12,
            ao50: newStats.ao50,
            ao100: newStats.ao100,
            updatedAt: Date.now()
        };

        await saveSession(updatedSession);

        setSolves(updatedSolves);
        setStats(newStats);
        setCurrentSession(updatedSession);

        return { solve: newSolve, stats: newStats };
    }, [currentSession, solves]);

    const updateSolvePenalty = useCallback(async (solveId, penalty) => {
        if (!currentSession) return;

        const updatedSolves = solves.map(s =>
            s.id === solveId ? { ...s, penalty } : s
        );

        const newStats = calculateAllStats(updatedSolves);

        const updatedSession = {
            ...currentSession,
            solves: updatedSolves,
            bestSingle: newStats.bestSingle,
            ao5: newStats.ao5,
            ao12: newStats.ao12,
            ao50: newStats.ao50,
            ao100: newStats.ao100,
            updatedAt: Date.now()
        };

        await saveSession(updatedSession);

        setSolves(updatedSolves);
        setStats(newStats);
        setCurrentSession(updatedSession);

        return { stats: newStats };
    }, [currentSession, solves]);

    const deleteSolve = useCallback(async (solveId) => {
        if (!currentSession) return;

        const updatedSolves = solves.filter(s => s.id !== solveId);
        const newStats = calculateAllStats(updatedSolves);

        const updatedSession = {
            ...currentSession,
            solves: updatedSolves,
            bestSingle: newStats.bestSingle,
            ao5: newStats.ao5,
            ao12: newStats.ao12,
            ao50: newStats.ao50,
            ao100: newStats.ao100,
            updatedAt: Date.now()
        };

        await saveSession(updatedSession);

        setSolves(updatedSolves);
        setStats(newStats);
        setCurrentSession(updatedSession);

        return { stats: newStats };
    }, [currentSession, solves]);

    const createSession = useCallback(async () => {
        return await createNewSession(currentEvent);
    }, [createNewSession, currentEvent]);

    const deleteSession = useCallback(async (sessionId) => {
        try {
            await deleteSessionFromDB(sessionId);
            await loadSessionsForEvent(currentEvent);
            if (currentSession?.sessionId === sessionId) {
                await loadLatestSession(currentEvent);
            }
        } catch (error) {
            console.error('Error deleting session:', error);
        }
    }, [currentEvent, currentSession, loadSessionsForEvent, loadLatestSession]);

    const renameSession = useCallback(async (sessionId, newName) => {
        try {
            const session = await getSession(sessionId);
            if (session) {
                session.name = newName;
                session.updatedAt = Date.now();
                await saveSession(session);
                await loadSessionsForEvent(currentEvent);
                if (currentSession?.sessionId === sessionId) {
                    setCurrentSession(session);
                }
            }
        } catch (error) {
            console.error('Error renaming session:', error);
        }
    }, [currentEvent, currentSession, loadSessionsForEvent]);

    useEffect(() => {
        loadLatestSession(currentEvent);
        loadSessionsForEvent(currentEvent);
    }, [currentEvent, loadLatestSession, loadSessionsForEvent]);

    useEffect(() => {
        if (user?.uid && !syncIntervalRef.current) {
            syncIntervalRef.current = setInterval(async () => {
                const now = Date.now();
                if (now - lastSyncRef.current > 30000) {
                    try {
                        setSyncStatus(SYNC_STATUS.SYNCING);
                        await syncTimerData(user.uid);
                        setSyncStatus(SYNC_STATUS.SYNCED);
                        lastSyncRef.current = now;
                    } catch (error) {
                        console.error('Auto-sync error:', error);
                        setSyncStatus(SYNC_STATUS.ERROR);
                    }
                }
            }, 30000);
        }

        return () => {
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
                syncIntervalRef.current = null;
            }
        };
    }, [user]);

    const manualSync = useCallback(async () => {
        if (!user?.uid) return;
        try {
            setSyncStatus(SYNC_STATUS.SYNCING);
            await syncTimerData(user.uid);
            setSyncStatus(SYNC_STATUS.SYNCED);
            lastSyncRef.current = Date.now();
        } catch (error) {
            console.error('Manual sync error:', error);
            setSyncStatus(SYNC_STATUS.ERROR);
        }
    }, [user]);

    return {
        currentEvent,
        currentSession,
        sessions,
        solves,
        stats,
        isLoading,
        syncStatus,
        switchEvent,
        addSolve,
        updateSolvePenalty,
        deleteSolve,
        createSession,
        deleteSession,
        renameSession,
        refreshSession: () => loadLatestSession(currentEvent),
        manualSync
    };
};