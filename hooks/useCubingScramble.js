'use client';

import { useEffect, useRef, useState } from 'react';

// eslint-disable-next-line no-unused-vars
const SCRAMBLE_CDN = 'https://cdn.cubing.net/v0/js/cubing/scramble';

export function useCubingScramble(eventId) {
    const [scramble, setScramble] = useState('');
    const [loading, setLoading] = useState(true);
    const scrambleFnRef = useRef(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const scriptId = 'cubing-scramble-module';
        if (document.getElementById(scriptId)) {
            if (window.cubing?.scramble?.randomScrambleForEvent) {
                scrambleFnRef.current = window.cubing.scramble.randomScrambleForEvent;
                if (eventId) generateScrambleInternal(eventId);
            }
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        // eslint-disable-next-line no-undef
        script.src = SCRAMBLE_CDN;
        script.type = 'module';
        script.onload = () => {
            if (window.cubing?.scramble?.randomScrambleForEvent) {
                scrambleFnRef.current = window.cubing.scramble.randomScrambleForEvent;
                if (eventId) generateScrambleInternal(eventId);
            }
        };
        script.onerror = () => console.error('[Cubing Scramble] Failed to load');
        document.head.appendChild(script);

        return () => {
            const el = document.getElementById(scriptId);
            if (el) el.remove();
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
        if (eventId) generateScrambleInternal(eventId);
    }, [eventId]);

    return { scramble, isLoading: loading, generateScramble };
}