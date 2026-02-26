'use client';

import { useEffect, useRef, useState } from 'react';

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

export default function ScrambleVisualization({ scramble, eventId, height = '200px' }) {
    const containerRef = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const puzzle = PUZZLE_MAP[eventId] || '3x3x3';
    const heightNum = parseInt(height) || 200;

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const loadTwisty = async () => {
            try {
                await import('https://cdn.cubing.net/v0/js/cubing/twisty');
                setIsLoaded(true);
            } catch (err) {
                console.error('[Twisty] Load error:', err);
            }
        };

        loadTwisty();
    }, []);

    useEffect(() => {
        if (!isLoaded || !scramble || !containerRef.current) return;

        containerRef.current.innerHTML = '';

        const player = document.createElement('twisty-player');
        player.setAttribute('puzzle', puzzle);
        player.setAttribute('alg', scramble);
        player.setAttribute('visualization', '2D');
        player.setAttribute('background', 'none');
        player.style.width = '100%';
        player.style.height = `${heightNum}px`;

        containerRef.current.appendChild(player);
    }, [scramble, puzzle, isLoaded, heightNum]);

    if (!scramble) {
        return (
            <div
                className="w-full bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center"
                style={{ minHeight: height }}
            >
                <span className="text-zinc-500 text-sm">No scramble</span>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="w-full bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center"
            style={{ minHeight: height }}
        >
            {!isLoaded && (
                <span className="text-zinc-500 text-sm">Loading 3D...</span>
            )}
        </div>
    );
}