'use client';

import { useEffect, useRef, useState, useMemo } from 'react';

const EVENT_TO_PUZZLE = {
    '333': '3x3x3',
    '222': '2x2x2',
    '444': '4x4x4',
    '555': '5x5x5',
    '666': '6x6x6',
    '777': '7x7x7',
    'pyram': 'pyraminx',
    'skewb': 'skewb',
    'sq1': 'sq1',
    'clock': 'clock',
    'minx': 'megaminx'
};

export default function ScrambleVisualization({ scramble, eventId, height = '150px' }) {
    const containerRef = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const playerRef = useRef(null);

    const puzzle = useMemo(() => EVENT_TO_PUZZLE[eventId] || '3x3x3', [eventId]);

    useEffect(() => {
        if (!scramble) return;

        let mounted = true;

        const loadTwisty = async () => {
            try {
                const existingScript = document.querySelector('script[src*="cubing/v0/js/cubing/twisty"]');
                if (!existingScript) {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdn.cubing.net/v0/js/cubing/twisty';
                        script.type = 'module';
                        script.onload = resolve;
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                }

                if (!mounted) return;

                await new Promise(r => setTimeout(r, 50));

                if (!mounted || !containerRef.current) return;

                if (playerRef.current) {
                    playerRef.current.remove();
                    playerRef.current = null;
                }

                const player = document.createElement('twisty-player');
                player.setAttribute('puzzle', puzzle);
                player.setAttribute('alg', scramble);
                player.setAttribute('hint', 'none');
                player.setAttribute('control-panel', 'none');
                player.setAttribute('background', 'none');
                player.style.width = '100%';
                player.style.height = height;
                player.style.display = 'block';

                containerRef.current.appendChild(player);
                playerRef.current = player;
                setIsLoaded(true);
            } catch (err) {
                console.error('Error loading 2D visualization:', err);
            }
        };

        loadTwisty();

        return () => {
            mounted = false;
            if (playerRef.current && playerRef.current.parentNode) {
                playerRef.current.remove();
                playerRef.current = null;
            }
        };
    }, [scramble, puzzle, height]);

    return (
        <div
            ref={containerRef}
            className="w-full flex items-center justify-center bg-transparent rounded-lg overflow-hidden"
            style={{ minHeight: height }}
        >
            {!isLoaded && (
                <div className="text-zinc-500 text-sm">Loading...</div>
            )}
        </div>
    );
}
