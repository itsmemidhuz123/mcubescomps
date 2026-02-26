'use client';

import { useEffect, useState } from 'react';
import { randomScrambleForEvent } from 'cubing/scramble';

export function useCubingScramble(eventId) {
    const [scramble, setScramble] = useState('');
    const [loading, setLoading] = useState(true);

    const generateScrambleInternal = async (evt) => {
        if (!evt) return;
        setLoading(true);
        try {
            const alg = await randomScrambleForEvent(evt);
            setScramble(alg.toString());
        } catch (e) {
            console.error('[Cubing Scramble] generate error', e);
            setScramble('');
        } finally {
            setLoading(false);
        }
    };

    // Generate on mount and when eventId changes
    useEffect(() => {
        if (eventId) {
            generateScrambleInternal(eventId);
        }
    }, [eventId]);

    // Public helper – can be called manually (e.g., on refresh button)
    const generateScramble = () => {
        if (eventId) generateScrambleInternal(eventId);
    };

    return { scramble, isLoading: loading, generateScramble };
}