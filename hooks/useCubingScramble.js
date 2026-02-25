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
    const lastEventRef = useRef(null);

    const generateScramble = useCallback(async () => {
        if (!eventId) {
            console.log('[Scramble] No eventId provided');
            return;
        }
        
        console.log('[Scramble] Generating scramble for event:', eventId);
        setLoading(true);
        
        try {
            const { randomScrambleForEvent } = await import('cubing/scramble');
            const mappedEvent = EVENT_MAP[eventId] || '333';
            
            console.log('[Scramble] Mapped event:', mappedEvent);
            
            const scrambleAlg = await randomScrambleForEvent(mappedEvent);
            const scrambleString = scrambleAlg ? scrambleAlg.toString() : '';
            
            console.log('[Scramble] Generated scramble:', scrambleString);
            
            if (mountedRef.current) {
                setScramble(scrambleString);
                lastEventRef.current = eventId;
            }
        } catch (err) {
            console.error('[Scramble] Generation error:', err);
            if (mountedRef.current) {
                setScramble('Error: Could not generate scramble');
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [eventId]);

    useEffect(() => {
        console.log('[Scramble] Hook mounted/updated, eventId:', eventId);
        mountedRef.current = true;
        
        if (eventId !== lastEventRef.current) {
            console.log('[Scramble] Event changed, generating new scramble');
            generateScramble();
        }

        return () => {
            mountedRef.current = false;
        };
    }, [eventId, generateScramble]);

    return { scramble, isLoading: loading, generateScramble };
}

export function useTwistyPlayer(scramble, eventId, containerRef) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const playerRef = useRef(null);

    useEffect(() => {
        console.log('[TwistyPlayer] Effect triggered:', { scramble: scramble?.substring(0, 20), eventId, hasContainer: !!containerRef.current });
        
        if (!containerRef.current || !scramble || !eventId) {
            setLoading(false);
            return;
        }

        let isMounted = true;

        const initializePlayer = async () => {
            try {
                console.log('[TwistyPlayer] Initializing player...');
                setLoading(true);
                setError(null);

                const { TwistyPlayer } = await import('cubing/twisty');

                if (!isMounted || !containerRef.current) {
                    console.log('[TwistyPlayer] Component unmounted, aborting');
                    return;
                }

                containerRef.current.innerHTML = '';

                const puzzleType = PUZZLE_MAP[eventId] || '3x3x3';
                console.log('[TwistyPlayer] Creating player with puzzle:', puzzleType);

                const player = new TwistyPlayer({
                    puzzle: puzzleType,
                    alg: scramble,
                    visualization: '3D',
                    background: 'none',
                    controlPanel: 'none',
                });

                if (isMounted && containerRef.current) {
                    containerRef.current.appendChild(player);
                    playerRef.current = player;
                    console.log('[TwistyPlayer] Player initialized successfully');
                    setLoading(false);
                }
            } catch (err) {
                console.error('[TwistyPlayer] Initialization error:', err);
                if (isMounted) {
                    setError('Failed to load 3D visualization');
                    setLoading(false);
                }
            }
        };

        initializePlayer();

        return () => {
            console.log('[TwistyPlayer] Cleaning up player');
            isMounted = false;
            if (playerRef.current) {
                playerRef.current = null;
            }
        };
    }, [scramble, eventId, containerRef]);

    return { loading, error };
}