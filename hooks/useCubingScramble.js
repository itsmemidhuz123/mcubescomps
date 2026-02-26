'use client';

import { useEffect, useState } from 'react';

export function useCubingScramble(eventId) {
    const [scramble, setScramble] = useState('');
    const [loading, setLoading] = useState(true);

    const generateScrambleInternal = async (evt) => {
        setLoading(true);
        try {
            const cubing = await import('cubing');
            const scrambleAlg = await cubing.randomScrambleForEvent(evt);
            setScramble(scrambleAlg.toString());
        } catch (e) {
            console.error('[Cubing Scramble] generate error', e);
            setScramble('');
        } finally {
            setLoading(false);
        }
    };

    const generateScramble = () => {
        if (eventId) generateScrambleInternal(eventId);
    };

    useEffect(() => {
        if (eventId) generateScrambleInternal(eventId);
    }, [eventId]);

    return { scramble, isLoading: loading, generateScramble };
}