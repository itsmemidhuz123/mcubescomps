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

let twistyLoaded = false;
let twistyLoadPromise = null;

function loadTwistyPlayer() {
    if (twistyLoaded) return Promise.resolve();
    if (twistyLoadPromise) return twistyLoadPromise;

    twistyLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.cubing.net/v0/js/cubing/twisty';
        script.type = 'module';
        script.onload = () => {
            twistyLoaded = true;
            resolve();
        };
        script.onerror = () => reject(new Error('Failed to load twisty-player'));
        document.head.appendChild(script);
    });

    return twistyLoadPromise;
}

export default function ScrambleVisualization({ scramble, eventId, height = '200px' }) {
    const containerRef = useRef(null);
    const playerRef = useRef(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!scramble || !containerRef.current) return;

        let mounted = true;

        const createPlayer = async () => {
            try {
                setLoading(true);
                await loadTwistyPlayer();

                if (!mounted) return;

                if (playerRef.current) {
                    playerRef.current.remove();
                    playerRef.current = null;
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
                if (mounted) {
                    console.error('Twisty player error:', err);
                    setError(err.message);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        createPlayer();

        return () => {
            mounted = false;
        };
    }, [scramble, eventId]);

    if (error) {
        return (
            <div className="w-full bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: height }}>
                <span className="text-red-400 text-sm">Error: {error}</span>
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
            {loading ? (
                <span className="text-zinc-500 text-sm">Loading 3D...</span>
            ) : (
                <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: height }} />
            )}
        </div>
    );
}
