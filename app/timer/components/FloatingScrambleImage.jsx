'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';

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

export default function FloatingScrambleImage({
    scramble,
    eventId,
    onClick,
    className = ''
}) {
    const containerRef = useRef(null);
    const playerRef = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);

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

                if (!mounted || !containerRef.current) return;

                await new Promise(r => setTimeout(r, 50));

                if (!mounted || !containerRef.current) return;

                if (playerRef.current) {
                    playerRef.current.remove();
                }

                const puzzle = EVENT_TO_PUZZLE[eventId] || '3x3x3';

                const player = document.createElement('twisty-player');
                player.setAttribute('puzzle', puzzle);
                player.setAttribute('alg', scramble);
                player.setAttribute('hint', 'none');
                player.setAttribute('control-panel', 'none');
                player.setAttribute('background', 'none');
                player.setAttribute('animation', 'none');
                player.style.width = '100%';
                player.style.height = '100%';

                containerRef.current.appendChild(player);
                playerRef.current = player;
                setIsLoaded(true);
            } catch (err) {
                console.error('Error loading floating scramble:', err);
            }
        };

        loadTwisty();

        return () => {
            mounted = false;
            if (playerRef.current) {
                playerRef.current.remove();
                playerRef.current = null;
            }
        };
    }, [scramble, eventId]);

    return (
        <button
            onClick={onClick}
            className={`relative group cursor-pointer ${className}`}
            title="View 3D scramble"
        >
            <div className="w-16 h-16 rounded-xl bg-[#161a23] border border-[#2a2f3a] overflow-hidden hover:border-blue-500/50 transition-colors">
                <div
                    ref={containerRef}
                    className="w-full h-full"
                />
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                <Maximize2 className="w-6 h-6 text-white" />
            </div>
        </button>
    );
}
