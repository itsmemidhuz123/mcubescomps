'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

let scriptLoaded = false;
let modulePromise = null;

async function loadScrambleModule() {
    if (scriptLoaded) {
        return window.cubingScramble;
    }

    if (modulePromise) {
        return modulePromise;
    }

    if (typeof window === 'undefined') {
        return null;
    }

    modulePromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.cubing.net/v0/js/cubing/scramble';
        script.type = 'module';

        script.onload = () => {
            const checkModule = setInterval(() => {
                if (window.cubing && window.cubing.scramble) {
                    clearInterval(checkModule);
                    scriptLoaded = true;
                    resolve(window.cubing.scramble);
                }
            }, 50);
        };

        script.onerror = () => {
            modulePromise = null;
            reject(new Error('Failed to load cubing scramble module'));
        };

        document.head.appendChild(script);
    });

    return modulePromise;
}

export function useCubingScramble(eventId) {
    const [scramble, setScramble] = useState('');
    const [loading, setLoading] = useState(true);
    const lastEventRef = useRef(null);

    const generateScramble = useCallback(async () => {
        if (!eventId) {
            return;
        }

        setLoading(true);

        try {
            const { randomScrambleForEvent } = await loadScrambleModule();
            const scrambleAlg = await randomScrambleForEvent(eventId);
            const scrambleString = scrambleAlg.toString();

            setScramble(scrambleString);
            lastEventRef.current = eventId;
        } catch (err) {
            console.error('[Scramble] Error:', err);
            setScramble('');
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        if (eventId && eventId !== lastEventRef.current) {
            generateScramble();
        }
    }, [eventId, generateScramble]);

    return { scramble, isLoading: loading, generateScramble };
}