'use client';

import { useEffect, useState } from 'react';

export function useCubingScramble(eventId) {
    const [scramble, setScramble] = useState('');
    const [loading, setLoading] = useState(true);
    const scrambleFnRef = { current: null };

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let mounted = true;

        const init = async () => {
            try {
                const { randomScrambleForEvent } = await import('cubing/scramble');
                if (!mounted) return;

                scrambleFnRef.current = randomScrambleForEvent;
                if (eventId) {
                    generateScrambleInternal(eventId);
                }
            } catch (err) {
                console.error('[Cubing Scramble] Failed to load:', err);
                setLoading(false);
            }
        };

        init();

        return () => {
            mounted = false;
        };
    }, [eventId]);

    const generateScrambleInternal = async (evt) => {
        if (!scrambleFnRef.current) return;
        setLoading(true);
        try {
            const alg = await scrambleFnRef.current(evt);
            setScramble(alg.toString());
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
        if (eventId && scrambleFnRef.current) {
            generateScrambleInternal(eventId);
        }
    }, [eventId]);

    return { scramble, isLoading: loading, generateScramble };
}