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
        if (!containerRef.current || !scramble || !eventId) {
            setLoading(false);
            return;
        }

        let isMounted = true;

        const initializePlayer = async () => {
            try {
                setLoading(true);
                setError(null);

                // Import twisty to register the web component globally
                await import('cubing/twisty');

                if (!isMounted || !containerRef.current) return;

                // Clear previous player
                containerRef.current.innerHTML = '';

                // Create the twisty-player element
                const player = document.createElement('twisty-player');
                player.setAttribute('alg', scramble);
                player.setAttribute('puzzle', PUZZLE_MAP[eventId] || '3x3x3');
                player.setAttribute('visualization', '3D');
                player.setAttribute('background', 'none');
                player.setAttribute('control-panel', 'none');
                
                // Style the player
                player.style.width = '100%';
                player.style.height = '100%';
                player.style.display = 'flex';
                player.style.alignItems = 'center';
                player.style.justifyContent = 'center';

                if (isMounted && containerRef.current) {
                    containerRef.current.appendChild(player);
                    setLoading(false);
                }
            } catch (err) {
                console.error('Failed to initialize Twisty player:', err);
                if (isMounted) {
                    setError('Failed to load 3D visualization');
                    setLoading(false);
                }
            }
        };

        initializePlayer();

        return () => {
            isMounted = false;
        };
    }, [scramble, eventId]);

    if (error) {
        return (
            <div 
                className="w-full bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center" 
                style={{ minHeight: height }}
            >
                <span className="text-red-400 text-sm">3D preview unavailable</span>
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