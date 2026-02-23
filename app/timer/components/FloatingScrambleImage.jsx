'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize2, Box } from 'lucide-react';

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

const EVENT_TO_DISPLAY = {
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

export default function FloatingScrambleImage({
    scramble,
    eventId,
    onClick,
    visualization = '2d',
    className = ''
}) {
    const containerRef = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const cleanupRef = useRef(null);

    useEffect(() => {
        if (!scramble) return;

        let mounted = true;
        const container = containerRef.current;
        if (!container) return;

        // Cleanup previous
        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }

        const loadScramble = async () => {
            try {
                // Load the appropriate module based on visualization type
                if (visualization === '3d') {
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
                } else {
                    const existingScript = document.querySelector('script[src*="cubing/v0/js/cubing/scramble-display"]');
                    if (!existingScript) {
                        await new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            script.src = 'https://cdn.cubing.net/v0/js/cubing/scramble-display';
                            script.type = 'module';
                            script.onload = resolve;
                            script.onerror = reject;
                            document.head.appendChild(script);
                        });
                    }
                }

                if (!mounted || !containerRef.current) return;

                await new Promise(r => setTimeout(r, 50));

                if (!mounted || !containerRef.current) return;

                // Safe cleanup - just clear innerHTML
                try {
                    containerRef.current.innerHTML = '';
                } catch (e) {
                    // Ignore
                }

                if (visualization === '3d') {
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
                } else {
                    const display = document.createElement('scramble-display');
                    display.setAttribute('event', EVENT_TO_DISPLAY[eventId] || '3x3x3');
                    display.setAttribute('scramble', scramble);
                    display.setAttribute('visualization', '2D');
                    display.setAttribute('checkered', 'true');
                    display.style.width = '100%';
                    display.style.height = '100%';
                    containerRef.current.appendChild(display);
                }

                setIsLoaded(true);
            } catch (err) {
                console.error('Error loading scramble:', err);
            }
        };

        loadScramble();

        // Cleanup function
        cleanupRef.current = () => {
            mounted = false;
        };

        return () => {
            mounted = false;
            try {
                if (containerRef.current) {
                    containerRef.current.innerHTML = '';
                }
            } catch (e) {
                // Ignore
            }
        };
    }, [scramble, eventId, visualization]);

    return (
        <button
            onClick={onClick}
            className={`relative group cursor-pointer ${className}`}
            title={visualization === '3d' ? 'View 3D scramble' : 'View 2D scramble'}
        >
            <div className="w-16 h-16 rounded-xl bg-[#161a23] border border-[#2a2f3a] overflow-hidden hover:border-blue-500/50 transition-colors">
                <div
                    ref={containerRef}
                    className="w-full h-full flex items-center justify-center"
                >
                    {!isLoaded && (
                        <Box className="w-6 h-6 text-zinc-600" />
                    )}
                </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                <Maximize2 className="w-6 h-6 text-white" />
            </div>
        </button>
    );
}
