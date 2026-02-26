'use client';

import { useEffect, useState } from 'react';

export function useCubingScramble(eventId) {
    const [scramble, setScramble] = useState('');
    const [loading, setLoading] = useState(true);

    // Load cubing script at runtime
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const scriptId = 'cubing-scramble-script';

        const loadScript = () => {
            return new Promise((resolve, reject) => {
                if (window.cubing?.randomScrambleForEvent) {
                    resolve(window.cubing);
                    return;
                }

                const existing = document.getElementById(scriptId);
                if (existing) {
                    existing.addEventListener('load', () => resolve(window.cubing));
                    existing.addEventListener('error', () => reject(new Error('Failed to load')));
                    return;
                }

                const script = document.createElement('script');
                script.id = scriptId;
                script.src = 'https://cdn.cubing.net/v0/js/cubing/scramble';
                script.type = 'module';
                script.onload = () => {
                    // Wait for module to initialize
                    setTimeout(() => resolve(window.cubing), 100);
                };
                script.onerror = () => reject(new Error('Failed to load'));
                document.head.appendChild(script);
            });
        };

        loadScript()
            .then((cubing) => {
                if (eventId && cubing?.randomScrambleForEvent) {
                    cubing.randomScrambleForEvent(eventId)
                        .then((alg) => setScramble(alg.toString()))
                        .catch((e) => {
                            console.error('[Cubing Scramble] generate error', e);
                            setScramble('');
                        })
                        .finally(() => setLoading(false));
                } else {
                    setLoading(false);
                }
            })
            .catch((e) => {
                console.error('[Cubing Scramble] load error', e);
                setLoading(false);
            });
    }, [eventId]);

    const generateScramble = () => {
        if (!eventId || !window.cubing?.randomScrambleForEvent) return;

        setLoading(true);
        window.cubing.randomScrambleForEvent(eventId)
            .then((alg) => setScramble(alg.toString()))
            .catch((e) => {
                console.error('[Cubing Scramble] generate error', e);
                setScramble('');
            })
            .finally(() => setLoading(false));
    };

    return { scramble, isLoading: loading, generateScramble };
}