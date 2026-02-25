'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const SCRAMBLE_CDN = 'https://cdn.cubing.net/v0/js/cubing/scramble';
const TWISTY_CDN = 'https://cdn.cubing.net/v0/js/cubing/twisty';

const EVENT_MAP = {
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

const PUZZLE_MAP = {
    '333': '3x3x3',
    '222': '2x2x2',
    '444': '4x4x4',
    '555': '5x5x5',
    '666': '6x6x6',
    '777': '7x7x7',
    'pyram': 'pyraminx',
    'skewb': 'skewb',
    'sq1': 'square1',
    'clock': 'clock',
    'minx': 'megaminx'
};

let scrambleLibPromise = null;
let twistyLibPromise = null;

function loadScrambleLib() {
    if (!scrambleLibPromise) {
        scrambleLibPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = SCRAMBLE_CDN;
            script.type = 'module';
            script.onload = async () => {
                try {
                    const mod = await import(/* webpackIgnore: true */ SCRAMBLE_CDN);
                    resolve(mod);
                } catch (e) {
                    reject(e);
                }
            };
            script.onerror = () => reject(new Error('Failed to load scramble lib'));
            document.head.appendChild(script);
        });
    }
    return scrambleLibPromise;
}

function loadTwistyLib() {
    if (!twistyLibPromise) {
        twistyLibPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = TWISTY_CDN;
            script.type = 'module';
            script.onload = () => resolve(true);
            script.onerror = () => reject(new Error('Failed to load twisty lib'));
            document.head.appendChild(script);
        });
    }
    return twistyLibPromise;
}

export function useCubingScramble(eventId) {
    const [scramble, setScramble] = useState(null);
    const [loading, setLoading] = useState(true);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        setLoading(true);

        const generateScramble = async () => {
            try {
                const lib = await loadScrambleLib();
                const { randomScrambleForEvent } = lib;
                const alg = await randomScrambleForEvent(EVENT_MAP[eventId] || '333');
                if (mountedRef.current) {
                    setScramble(alg ? alg.toString() : '');
                }
            } catch (err) {
                console.error('Scramble error:', err);
                if (mountedRef.current) {
                    setScramble('');
                }
            } finally {
                if (mountedRef.current) {
                    setLoading(false);
                }
            }
        };

        generateScramble();

        return () => {
            mountedRef.current = false;
        };
    }, [eventId]);

    const generateScramble = useCallback(async () => {
        setLoading(true);
        try {
            const lib = await loadScrambleLib();
            const { randomScrambleForEvent } = lib;
            const alg = await randomScrambleForEvent(EVENT_MAP[eventId] || '333');
            setScramble(alg ? alg.toString() : '');
        } catch (err) {
            console.error('Scramble error:', err);
            setScramble('');
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    return { scramble, isLoading: loading, generateScramble };
}

export function useTwistyPlayer(scramble, eventId, containerRef) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!scramble || !containerRef?.current) return;

        let mounted = true;

        const initPlayer = async () => {
            try {
                setLoading(true);
                await loadTwistyLib();

                if (!mounted || !containerRef.current) return;

                const container = containerRef.current;
                container.innerHTML = '';

                const player = document.createElement('twisty-player');
                player.setAttribute('alg', scramble);
                player.setAttribute('puzzle', PUZZLE_MAP[eventId] || '3x3x3');
                player.setAttribute('background', 'none');
                player.setAttribute('show-controls', 'false');
                player.setAttribute('show-toolbar', 'false');
                player.setAttribute('show-options', 'false');
                player.setAttribute('hint', 'none');
                player.setAttribute('camera-control', 'none');
                player.setAttribute('keyboard-shortcuts', 'none');
                player.setAttribute('animation', 'duration:0');
                player.style.width = '100%';
                player.style.height = '100%';
                player.style.border = 'none';

                container.appendChild(player);
                setError(null);
            } catch (err) {
                if (mounted) {
                    setError(err.message);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        initPlayer();

        return () => {
            mounted = false;
        };
    }, [scramble, eventId, containerRef]);

    return { loading, error };
}

export default useCubingScramble;