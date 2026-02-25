'use client';

import { useState, useEffect, useCallback } from 'react';

const SCRAMBLE_APIS = {
    '333': 'https://scramble.cubing.net/v0/scramble/3x3x3',
    '222': 'https://scramble.cubing.net/v0/scramble/2x2x2',
    '444': 'https://scramble.cubing.net/v0/scramble/4x4x4',
    '555': 'https://scramble.cubing.net/v0/scramble/5x5x5',
    '666': 'https://scramble.cubing.net/v0/scramble/6x6x6',
    '777': 'https://scramble.cubing.net/v0/scramble/7x7x7',
    'pyram': 'https://scramble.cubing.net/v0/scramble/pyram',
    'skewb': 'https://scramble.cubing.net/v0/scramble/skewb',
    'sq1': 'https://scramble.cubing.net/v0/scramble/sq1',
    'clock': 'https://scramble.cubing.net/v0/scramble/clock',
    'minx': 'https://scramble.cubing.net/v0/scramble/megaminx'
};

export function useCubingScramble(eventId) {
    const [scramble, setScramble] = useState(null);
    const [loading, setLoading] = useState(true);

    const generate = useCallback(async () => {
        setLoading(true);
        try {
            const apiUrl = SCRAMBLE_APIS[eventId] || SCRAMBLE_APIS['333'];
            const response = await fetch(apiUrl);
            const data = await response.json();
            setScramble(data.scramble);
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
