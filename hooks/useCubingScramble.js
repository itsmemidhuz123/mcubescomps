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
                body: JSON.stringify({ event: eventId || '333' })
            });
            const data = await response.json();

            if (data.error) {
                console.error('Scramble API error:', data.error);
                setScramble('');
            } else {
                setScramble(data.scramble || '');
            }
        } catch (err) {
            console.error('Scramble fetch error:', err);
            setScramble('');
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        setScramble(null);
        generate();
    }, [eventId]);

    return { scramble, isLoading: loading, generateScramble: generate };
}

export default useCubingScramble;