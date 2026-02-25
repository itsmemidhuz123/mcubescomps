'use client';

import { useState, useEffect, useCallback } from 'react';

export function useCubingScramble(eventId) {
    const [scramble, setScramble] = useState(null);
    const [loading, setLoading] = useState(true);

    const generate = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/scramble', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: eventId })
            });
            const data = await response.json();
            setScramble(data.scramble || '');
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

export default useCubingScramble;