'use client';

import { useState, useEffect, useCallback } from 'react';

export function useCubingScramble(eventId) {
    const [scramble, setScramble] = useState(null);
    const [loading, setLoading] = useState(true);

    const generate = useCallback(async () => {
        setLoading(true);
        try {
            const { randomScrambleForEvent } = await import('https://cdn.cubing.net/v0/js/cubing/scramble');
            const alg = await randomScrambleForEvent(eventId);
            setScramble(alg.toString());
        } catch (err) {
            console.error('Scramble error:', err);
            setScramble('');
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        generate();
    }, [eventId, generate]);

    return { scramble, isLoading: loading, generateScramble: generate };
}
