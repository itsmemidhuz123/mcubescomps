'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { generateScramble as fallbackGenerateScramble } from './useScrambleEngine';

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

let scrambleModulePromise = null;
let twistyModulePromise = null;

function getScrambleModule() {
    if (!scrambleModulePromise) {
        scrambleModulePromise = import('cubing/scramble').catch(err => {
            console.error('[Cubing] Failed to load scramble module:', err);
            return null;
        });
    }
    return scrambleModulePromise;
}

function getTwistyModule() {
    if (!twistyModulePromise) {
        twistyModulePromise = import('cubing/twisty').catch(err => {
            console.error('[Cubing] Failed to load twisty module:', err);
            return null;
        });
    }
    return twistyModulePromise;
}

export function useCubingScramble(eventId) {
    const [scramble, setScramble] = useState('');
    const [loading, setLoading] = useState(true);
    const mountedRef = useRef(true);
    const lastEventRef = useRef(null);

    const generateScramble = useCallback(async () => {
        if (!eventId) {
            return;
        }

        setLoading(true);

        try {
            const module = await getScrambleModule();

            if (module && module.randomScrambleForEvent) {
                const mappedEvent = EVENT_MAP[eventId] || '333';
                const scrambleAlg = await module.randomScrambleForEvent(mappedEvent);
                const scrambleString = scrambleAlg ? scrambleAlg.toString() : '';

                if (mountedRef.current) {
                    setScramble(scrambleString);
                    lastEventRef.current = eventId;
                }
            } else {
                const fallbackScramble = fallbackGenerateScramble(eventId);
                if (mountedRef.current) {
                    setScramble(fallbackScramble);
                    lastEventRef.current = eventId;
                }
            }
        } catch (err) {
            console.error('[Scramble] Generation error, using fallback:', err);
            if (mountedRef.current) {
                const fallbackScramble = fallbackGenerateScramble(eventId);
                setScramble(fallbackScramble);
                lastEventRef.current = eventId;
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [eventId]);

    useEffect(() => {
        mountedRef.current = true;

        if (eventId !== lastEventRef.current) {
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
        if (!containerRef?.current || !scramble || !eventId) {
            setLoading(false);
            return;
        }

        let isMounted = true;

        const initializePlayer = async () => {
            try {
                setLoading(true);
                setError(null);

                const module = await getTwistyModule();

                if (!isMounted || !containerRef?.current || !module || !module.TwistyPlayer) {
                    if (isMounted) {
                        setError('3D visualization unavailable');
                        setLoading(false);
                    }
                    return;
                }

                containerRef.current.innerHTML = '';

                const puzzleType = PUZZLE_MAP[eventId] || '3x3x3';

                const player = new module.TwistyPlayer({
                    puzzle: puzzleType,
                    alg: scramble,
                    visualization: '3D',
                    background: 'none',
                    controlPanel: 'none',
                });

                if (isMounted && containerRef?.current) {
                    containerRef.current.appendChild(player);
                    playerRef.current = player;
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
            isMounted = false;
            if (playerRef.current) {
                playerRef.current = null;
            }
        };
    }, [scramble, eventId, containerRef]);

    return { loading, error };
}