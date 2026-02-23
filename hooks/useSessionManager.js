import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    saveSession,
    getLatestSession,
    getSessionsByEvent,
    getAllSessions,
    deleteSession as deleteSessionFromDB,
    generateSessionId
} from '@/lib/indexedDB';
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

        const newSolve = {
            ...solve,
            id: `solve_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: solve.createdAt || Date.now()
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

    useEffect(() => {
        loadLatestSession(currentEvent);
    }, [currentEvent, loadLatestSession]);

    return {
        currentEvent,
        currentSession,
        sessions,
        solves,
        stats,
        isLoading,
        switchEvent,
        addSolve,
        updateSolvePenalty,
        deleteSolve,
        createSession,
        refreshSession: () => loadLatestSession(currentEvent)
    };
};