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
    const [twistyLoaded, setTwistyLoaded] = useState(false);
    const containerRef = useRef(null);
    const scriptLoadedRef = useRef(false);

    useEffect(() => {
        if (scriptLoadedRef.current) return;
        scriptLoadedRef.current = true;

        const script = document.createElement('script');
        script.src = 'https://cdn.cubing.net/v0/js/cubing/twisty';
        script.type = 'module';
        script.onload = () => setTwistyLoaded(true);
        document.head.appendChild(script);
    }, []);

    useEffect(() => {
        if (!twistyLoaded || !scramble || !containerRef.current) return;

        // Clear and recreate the player
        containerRef.current.innerHTML = '';

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

        containerRef.current.appendChild(player);
    }, [scramble, eventId, twistyLoaded]);

    if (!scramble) {
        return (
            <div className="w-full">
                <div
                    className="w-full flex items-center justify-center bg-zinc-900 rounded-lg overflow-hidden"
                    style={{ minHeight: height }}
                >
                    <span className="text-zinc-500">Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: height, height }}>
            {twistyLoaded ? (
                <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
            ) : (
                <span className="text-zinc-500">Loading 3D...</span>
            )}
        </div>
    );
}
