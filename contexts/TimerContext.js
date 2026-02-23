'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSessionManager } from '@/hooks/useSessionManager';
import { getEventById, WCA_EVENTS, DEFAULT_EVENT } from '@/lib/events';

const TimerContext = createContext(null);

export const TimerProvider = ({ children }) => {
    const sessionManager = useSessionManager();
    const [settings, setSettings] = useState({
        inspectionEnabled: true,
        showScrambleImage: true,
        theme: 'dark'
    });
    const [scramble, setScramble] = useState('');
    const [scrambleImageUrl, setScrambleImageUrl] = useState('');

    const event = getEventById(sessionManager.currentEvent);

    const updateSettings = useCallback((newSettings) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    }, []);

    const value = {
        ...sessionManager,
        event,
        allEvents: WCA_EVENTS,
        settings,
        updateSettings,
        scramble,
        setScramble,
        scrambleImageUrl,
        setScrambleImageUrl
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