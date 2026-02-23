'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const EVENT_IDS = {
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
    'minx': 'minx'
};

export const useCubingScramble = (eventId) => {
    const [scramble, setScramble] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const scrambleModuleRef = useRef(null);

    const loadScrambleModule = useCallback(async () => {
        if (scrambleModuleRef.current) {
            return scrambleModuleRef.current;
        }

        try {
            const module = await import('https://cdn.cubing.net/js/cubing/scramble');
            scrambleModuleRef.current = module;
            return module;
        } catch (err) {
            console.error('Failed to load cubing.js:', err);
            throw err;
        }
    }, []);

    const generateScramble = useCallback(async () => {
        const cubingEventId = EVENT_IDS[eventId] || '333';

        setIsLoading(true);
        setError(null);

        try {
            const { randomScrambleForEvent } = await loadScrambleModule();
            const scrambleAlg = await randomScrambleForEvent(cubingEventId);
            const scrambleString = scrambleAlg.toString();
            setScramble(scrambleString);
            setError(null);
        } catch (err) {
            console.error('Error generating scramble:', err);
            setError(err.message);
            setScramble('R U R\' U\'');
        } finally {
            setIsLoading(false);
        }
    }, [eventId, loadScrambleModule]);

    useEffect(() => {
        if (eventId) {
            generateScramble();
        }
    }, [eventId, generateScramble]);

    return {
        scramble,
        isLoading,
        error,
        generateScramble
    };
};

export { EVENT_IDS };