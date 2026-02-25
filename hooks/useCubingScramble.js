'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

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
    'minx': 'minx',
    '333bf': '333',
    '333oh': '333',
    '333fm': '333',
    '444bf': '444',
    '555bf': '555',
    '333mbf': '333'
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
    'minx': 'megaminx',
    '333bf': '3x3x3',
    '333oh': '3x3x3',
    '333fm': '3x3x3',
    '444bf': '4x4x4',
    '555bf': '5x5x5',
    '333mbf': '3x3x3'
};

export function useCubingScramble(eventId) {
    const [scramble, setScramble] = useState('');
    const [loading, setLoading] = useState(true);
    const mountedRef = useRef(true);

    const generateScramble = useCallback(async () => {
        if (!eventId) return;
        
        setLoading(true);
        try {
            const { randomScrambleForEvent } = await import('cubing/scramble');
            const alg = await randomScrambleForEvent(EVENT_MAP[eventId] || '333');
            
            if (mountedRef.current) {
                setScramble(alg ? alg.toString() : '');
            }
        } catch (err) {
            console.error('Scramble generation error:', err);
            if (mountedRef.current) {
                setScramble('');
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [eventId]);

    useEffect(() => {
        mountedRef.current = true;
        generateScramble();

        return () => {
            mountedRef.current = false;
        };
    }, [generateScramble]);

    return { scramble, isLoading: loading, generateScramble };
}

export function useTwistyPlayer(scramble, eventId, containerRef) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const playerRef = useRef(null);

    useEffect(() => {
        const container = containerRef?.current;
        if (!container || !scramble || !eventId) {
            setLoading(false);
            return;
        }

        let isMounted = true;

        const initPlayer = async () => {
            try {
                setLoading(true);
                setError(null);

                // Import and register the twisty-player web component
                const { TwistyPlayer } = await import('cubing/twisty');

                if (!isMounted || !container) return;

                // Clear previous content
                container.innerHTML = '';

                // Create player element using the imported class
                const player = new TwistyPlayer({
                    alg: scramble,
                    puzzle: PUZZLE_MAP[eventId] || '3x3x3',
                    visualization: '3D',
                    background: 'none',
                    controlPanel: 'none'
                });

                if (isMounted && container) {
                    container.appendChild(player);
                    playerRef.current = player;
                }
            } catch (err) {
                console.error('Twisty player init error:', err);
                if (isMounted) {
                    setError('Failed to load 3D preview');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        initPlayer();

        return () => {
            isMounted = false;
            if (container && playerRef.current) {
                try {
                    if (container.contains(playerRef.current)) {
                        container.removeChild(playerRef.current);
                    }
                } catch (e) {
                    console.error('Error removing player:', e);
                }
            }
        };
    }, [scramble, eventId, containerRef]);

    return { loading, error };
}