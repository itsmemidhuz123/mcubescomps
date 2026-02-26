'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export function useCubingScramble(eventId) {
    const [scramble, setScramble] = useState('');
    const [loading, setLoading] = useState(true);
    const lastEventRef = useRef(null);
    const scrambleFnRef = useRef(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const scriptId = 'cubing-scramble-module';
        if (document.getElementById(scriptId)) {
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://cdn.cubing.net/v0/js/cubing/scramble';
        script.type = 'module';
        
        script.onload = () => {
            const checkReady = setInterval(() => {
                if (window.cubing && window.cubing.scramble && window.cubing.scramble.randomScrambleForEvent) {
                    clearInterval(checkReady);
                    scrambleFnRef.current = window.cubing.scramble.randomScrambleForEvent;
                    
                    if (eventId) {
                        generateScrambleInternal(eventId);
                    }
                }
            }, 100);
        };
        
        document.head.appendChild(script);
    }, []);

    const generateScrambleInternal = useCallback(async (evt) => {
        if (!evt || !scrambleFnRef.current) return;

        setLoading(true);
        try {
            const scrambleAlg = await scrambleFnRef.current(evt);
            const scrambleString = scrambleAlg.toString();
            setScramble(scrambleString);
            lastEventRef.current = evt;
        } catch (err) {
            console.error('[Scramble] Error:', err);
            setScramble('');
        } finally {
            setLoading(false);
        }
    }, []);

    const generateScramble = useCallback(() => {
        if (eventId) {
            generateScrambleInternal(eventId);
        }
    }, [eventId, generateScrambleInternal]);

    useEffect(() => {
        if (eventId && eventId !== lastEventRef.current && scrambleFnRef.current) {
            generateScrambleInternal(eventId);
        }
    }, [eventId, generateScrambleInternal]);

    return { scramble, isLoading: loading, generateScramble };
}