'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { generateScramble as generateScrambleFallback } from './useScrambleEngine';

const EVENT_MAP = {
    '333': '333',
    '222': '222',
    '444': '444',
    '555': '555',
    '666': '666',
    '777': '777',
    'pyram': 'pyram',
    'skewb': 'skewb',
    'sq1': 'sq1',
    'clock': 'clock',
    'minx': 'minx',
    '333bf': '333',
    '333oh': '333',
    '333fm': '333',
    '444bf': '444',
    '555bf': '555',
    '333mbf': '333'
};

let scrambleModulePromise = null;
let scrambleModuleLoaded = false;

async function loadScrambleModule() {
    if (scrambleModuleLoaded && typeof window !== 'undefined') {
        const cubing = window.cubing;
        if (cubing && cubing.scramble) {
            return cubing.scramble;
        }
    }

    if (scrambleModulePromise) {
        return scrambleModulePromise;
    }

    if (typeof window === 'undefined') {
        return null;
    }

    scrambleModulePromise = new Promise((resolve, reject) => {
        const scriptId = 'cubing-scramble-cdn';
        const existingScript = document.getElementById(scriptId);

        if (existingScript) {
            const checkLoaded = () => {
                if (window.cubing && window.cubing.scramble) {
                    scrambleModuleLoaded = true;
                    resolve(window.cubing.scramble);
                } else {
                    setTimeout(checkLoaded, 100);
                }
            };
            checkLoaded();
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://cdn.cubing.net/v0/js/cubing/scramble';
        script.type = 'module';

        script.onload = () => {
            const checkLoaded = () => {
                if (window.cubing && window.cubing.scramble) {
                    scrambleModuleLoaded = true;
                    resolve(window.cubing.scramble);
                } else {
                    setTimeout(checkLoaded, 50);
                }
            };
            checkLoaded();
        };

        script.onerror = () => {
            scrambleModulePromise = null;
            reject(new Error('Failed to load cubing CDN'));
        };

        document.head.appendChild(script);
    });

    return scrambleModulePromise;
}

export function useCubingScramble(eventId) {
    const [scramble, setScramble] = useState('');
    const [loading, setLoading] = useState(true);
    const [usingFallback, setUsingFallback] = useState(false);
    const mountedRef = useRef(true);
    const lastEventRef = useRef(null);

    const generateScramble = useCallback(async () => {
        if (!eventId) {
            return;
        }

        setLoading(true);

        try {
            const module = await loadScrambleModule();

            if (module && module.randomScrambleForEvent) {
                const mappedEvent = EVENT_MAP[eventId] || '333';
                const scrambleAlg = await module.randomScrambleForEvent(mappedEvent);
                const scrambleString = scrambleAlg ? scrambleAlg.toString() : '';

                if (mountedRef.current) {
                    setScramble(scrambleString);
                    setUsingFallback(false);
                    lastEventRef.current = eventId;
                }
            } else {
                throw new Error('Module not available');
            }
        } catch (err) {
            console.warn('[Scramble] CDN failed, using fallback:', err.message);
            if (mountedRef.current) {
                const fallbackScramble = generateScrambleFallback(eventId);
                setScramble(fallbackScramble);
                setUsingFallback(true);
                lastEventRef.current = eventId;
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [eventId]);

    useEffect(() => {
        mountedRef.current = true;

        if (eventId !== lastEventRef.current) {
            generateScramble();
        }

        return () => {
            mountedRef.current = false;
        };
    }, [eventId, generateScramble]);

    return { scramble, isLoading: loading, generateScramble, usingFallback };
}

export function useTwistyPlayer(scramble, eventId, containerRef) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('3D preview: use ScrambleDisplay component instead');

    return { loading, error };
}