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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
                await import('cubing/twisty');

                if (!isMounted || !container) return;

                // Clear previous content
                container.innerHTML = '';

                // Create twisty-player element
                const player = document.createElement('twisty-player');
                player.setAttribute('alg', scramble);
                player.setAttribute('puzzle', PUZZLE_MAP[eventId] || '3x3x3');
                player.setAttribute('visualization', '3D');
                player.setAttribute('background', 'none');
                player.setAttribute('control-panel', 'none');
                player.style.width = '100%';
                player.style.height = '100%';

                if (isMounted && container) {
                    container.appendChild(player);
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
                <span className="text-zinc-500 text-sm">Loading scramble...</span>
            </div>
        );
    }

    return (
        <div 
            ref={containerRef} 
            className="w-full bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center" 
            style={{ minHeight: height }}
        >
            {loading && (
                <span className="text-zinc-500 text-sm">Loading 3D...</span>
            )}
        </div>
    );
}