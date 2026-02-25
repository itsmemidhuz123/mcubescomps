'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
// We'll use dynamic imports for the heavy cubing library to avoid SSR issues and reduce initial bundle size

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
            // Dynamic import to avoid SSR issues
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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!scramble || !container) return;

        let mounted = true;

        const initPlayer = async () => {
            try {
                setLoading(true);
                
                // Import twisty player specifically
                // This registers the <twisty-player> custom element
                await import('cubing/twisty');

                if (!mounted || !container) return;

                // Clear previous content
                container.innerHTML = '';

                // Create and configure the player element
                const player = document.createElement('twisty-player');
                player.setAttribute('alg', scramble);
                player.setAttribute('puzzle', PUZZLE_MAP[eventId] || '3x3x3');
                player.setAttribute('visualization', '3D');
                player.setAttribute('background', 'none');
                player.setAttribute('control-panel', 'none');
                
                // Ensure proper sizing
                player.style.width = '100%';
                player.style.height = '100%';
                
                container.appendChild(player);
                setError(null);
            } catch (err) {
                console.error('Twisty player init error:', err);
                if (mounted) {
                    setError('Failed to load 3D preview');
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        // Small delay to ensure DOM is ready and avoid race conditions
        const timeoutId = setTimeout(initPlayer, 50);

        return () => {
            mounted = false;
            clearTimeout(timeoutId);
            if (container) {
                container.innerHTML = '';
            }
        };
    }, [scramble, eventId, containerRef]);

    return { loading, error };
}