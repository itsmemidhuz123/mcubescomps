"use client";

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'cstimer_sessions';

export function useTimerStorage() {
  const [sessions, setSessions] = useState({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSessions(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
  }, []);

  const saveSessions = useCallback((newSessions) => {
    setSessions(newSessions);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSessions));
    } catch (e) {
      console.error('Failed to save sessions:', e);
    }
  }, []);

  const getSession = useCallback((eventId) => {
    return sessions[eventId] || { solves: [], name: 'Session 1' };
  }, [sessions]);

  const addSolve = useCallback((eventId, solve) => {
    const session = getSession(eventId);
    const newSolve = {
      ...solve,
      id: Date.now().toString(),
      createdAt: Date.now(),
    };
    const newSession = {
      ...session,
      solves: [newSolve, ...session.solves],
    };
    saveSessions({ ...sessions, [eventId]: newSession });
    return newSolve;
  }, [sessions, getSession, saveSessions]);

  const deleteSolve = useCallback((eventId, solveId) => {
    const session = getSession(eventId);
    const newSession = {
      ...session,
      solves: session.solves.filter(s => s.id !== solveId),
    };
    saveSessions({ ...sessions, [eventId]: newSession });
  }, [sessions, getSession, saveSessions]);

  const updateSolvePenalty = useCallback((eventId, solveId, penalty) => {
    const session = getSession(eventId);
    const newSession = {
      ...session,
      solves: session.solves.map(s => 
        s.id === solveId ? { ...s, penalty } : s
      ),
    };
    saveSessions({ ...sessions, [eventId]: newSession });
  }, [sessions, getSession, saveSessions]);

  const resetSession = useCallback((eventId) => {
    const newSessions = { ...sessions, [eventId]: { solves: [], name: 'Session 1' } };
    saveSessions(newSessions);
  }, [sessions, saveSessions]);

  const createSession = useCallback((eventId, name) => {
    const newSessions = { 
      ...sessions, 
      [eventId]: { solves: [], name: name || 'Session 1' } 
    };
    saveSessions(newSessions);
  }, [sessions, saveSessions]);

  return {
    sessions,
    getSession,
    addSolve,
    deleteSolve,
    updateSolvePenalty,
    resetSession,
    createSession,
  };
}
