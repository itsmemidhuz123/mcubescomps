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
    '333mbf': '3x3x3',
};

export default function ScrambleVisualization({ scramble, eventId, height = '200px' }) {
    const containerRef = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const puzzle = PUZZLE_MAP[eventId] || '3x3x3';
    const heightNum = parseInt(height) || 200;

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!scramble) return;

        const scriptId = 'cubing-twisty-script';

        const loadScript = () => {
            return new Promise((resolve, reject) => {
                if (window.cubing?.TwistyPlayer) {
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
                script.src = 'https://cdn.cubing.net/v0/js/cubing/twisty';
                script.type = 'module';
                script.onload = () => {
                    setTimeout(() => resolve(window.cubing), 100);
                };
                script.onerror = () => reject(new Error('Failed to load'));
                document.head.appendChild(script);
            });
        };

        loadScript()
            .then((cubing) => {
                if (!containerRef.current) return;

                const TwistyPlayer = cubing.TwistyPlayer;
                const player = new TwistyPlayer({
                    puzzle: puzzle,
                    alg: scramble,
                    visualization: '2D',
                    background: 'none',
                });
                player.style.width = '100%';
                player.style.height = `${heightNum}px`;

                containerRef.current.innerHTML = '';
                containerRef.current.appendChild(player);
                setIsLoaded(true);
            })
            .catch((err) => {
                console.error('[Twisty] Failed to load:', err);
            });
    }, [scramble, puzzle, heightNum]);

    return (
        <div
            ref={containerRef}
            className="w-full bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center"
            style={{ minHeight: height }}
        >
            {!isLoaded && <span className="text-zinc-500 text-sm">Loading...</span>}
        </div>
    );
}
