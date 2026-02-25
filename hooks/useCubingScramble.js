'use client';

import { useState, useEffect, useCallback } from 'react';

const EVENT_ID_MAP = {
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

export function useCubingScramble(eventId) {
    const [scramble, setScramble] = useState(null);
    const [loading, setLoading] = useState(true);

    const generate = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/scramble', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: EVENT_ID_MAP[eventId] || '333' })
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
        setScramble(null);
        generate();
    }, [eventId]);

    return { scramble, isLoading: loading, generateScramble: generate };
}

export default useCubingScramble;