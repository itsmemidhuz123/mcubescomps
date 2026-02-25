'use client';

import { useState, useEffect, useRef } from 'react';

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

export default function ScrambleVisualization({ scramble, eventId, height = '200px' }) {
    const containerRef = useRef(null);
    const playerRef = useRef(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!scramble || !containerRef.current) return;

        const createPlayer = async () => {
            try {
                if (!customElements.get('twisty-player')) {
                    await import('https://cdn.cubing.net/v0/js/cubing/twisty');
                }

                if (playerRef.current) {
                    playerRef.current.remove();
                }

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
                player.style.display = 'block';

                containerRef.current.innerHTML = '';
                containerRef.current.appendChild(player);
                playerRef.current = player;
                setError(null);
            } catch (err) {
                console.error('Twisty player error:', err);
                setError(err.message);
            }
        };

        createPlayer();
    }, [scramble, eventId]);

    if (error) {
        return (
            <div className="w-full bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: height }}>
                <span className="text-red-400 text-sm">Error loading visualization</span>
            </div>
        );
    }

    if (!scramble) {
        return (
            <div className="w-full bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: height }}>
                <span className="text-zinc-500 text-sm">No scramble</span>
            </div>
        );
    }

    return (
        <div className="w-full bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: height }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: height }} />
        </div>
    );
}
