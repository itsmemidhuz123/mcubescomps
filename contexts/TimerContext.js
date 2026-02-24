'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSessionManager } from '@/hooks/useSessionManager';
import { getEventById, WCA_EVENTS, DEFAULT_EVENT } from '@/lib/events';

const TIMER_SETTINGS_KEY = 'timer_settings';

const DEFAULT_SETTINGS = {
    decimalPoints: 2,
    showScrambleImage: true,
    showLargeAverages: false,
    showSessionStatsPanel: true,
    inspectionEnabled: true,
    freezeTime: 0.2,
    autoConfirmSolve: false,
    enableSounds: true,
    enablePBAnimation: false,
    focusModeDefault: false,
    fullscreenOnStart: false,
    defaultScrambleVisualization: '2d'
};

const TimerContext = createContext(null);

export const TimerProvider = ({ children }) => {
    const sessionManager = useSessionManager();
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [scramble, setScramble] = useState('');
    const [scrambleImageUrl, setScrambleImageUrl] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(TIMER_SETTINGS_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setSettings(prev => ({ ...DEFAULT_SETTINGS, ...parsed }));
            }
        } catch (e) { }
        setIsLoading(false);
    }, []);

    const updateSettings = useCallback((newSettings) => {
        setSettings(prev => {
            const updated = { ...prev, ...newSettings };
            try {
                localStorage.setItem(TIMER_SETTINGS_KEY, JSON.stringify(updated));
            } catch (e) { }
            return updated;
        });
    }, []);

    const resetCurrentSession = useCallback(() => {
        return sessionManager.createSession();
    }, [sessionManager]);

    const resetAllTimerData = useCallback(async () => {
        try {
            localStorage.removeItem(TIMER_SETTINGS_KEY);
            localStorage.removeItem('timer_current_scramble');
            localStorage.removeItem('timer_current_event');
            localStorage.removeItem('timer_visualization');
            setSettings(DEFAULT_SETTINGS);
            await sessionManager.createSession();
        } catch (e) {
            console.error('Error resetting timer data:', e);
        }
    }, [sessionManager]);

    const event = getEventById(sessionManager.currentEvent);

    const value = {
        ...sessionManager,
        event,
        allEvents: WCA_EVENTS,
        settings,
        updateSettings,
        resetCurrentSession,
        resetAllTimerData,
        scramble,
        setScramble,
        scrambleImageUrl,
        setScrambleImageUrl,
        isLoading
    };

    return (
        <TimerContext.Provider value={value}>
            {children}
        </TimerContext.Provider>
    );
};

export const useTimer = () => {
    const context = useContext(TimerContext);
    if (!context) {
        throw new Error('useTimer must be used within a TimerProvider');
    }
    return context;
};

export default TimerContext;