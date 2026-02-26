'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
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

function loadCubingScript() {
    return new Promise((resolve, reject) => {
        if (window.cubing) {
            resolve(window.cubing);
            return;
        }

        const scriptId = 'cubing-main-script';
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
        script.onload = () => setTimeout(() => resolve(window.cubing), 100);
        script.onerror = () => reject(new Error('Failed to load'));
        document.head.appendChild(script);
    });
}

function FloatingScrambleInner({ scramble, eventId, visualization, onClick }) {
    const containerRef = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!scramble) return;
        if (typeof window === 'undefined') return;

        let cancelled = false;

        loadCubingScript()
            .then((cubing) => {
                if (cancelled || !containerRef.current) return;

                if (visualization === '3d') {
                    const TwistyPlayer = cubing.TwistyPlayer;
                    const player = new TwistyPlayer({
                        puzzle: EVENT_TO_PUZZLE[eventId] || '3x3x3',
                        alg: scramble,
                        hint: 'none',
                        controlPanel: 'none',
                        background: 'none',
                    });
                    player.style.width = '100%';
                    player.style.height = '100%';
                    containerRef.current.innerHTML = '';
                    containerRef.current.appendChild(player);
                } else {
                    const ScrambleDisplay = cubing.ScrambleDisplay;
                    const display = new ScrambleDisplay({
                        event: EVENT_TO_DISPLAY[eventId] || '3x3x3',
                        visualization: '2D',
                        checkered: true,
                        alg: scramble,
                    });
                    display.style.width = '100%';
                    display.style.height = '100%';
                    containerRef.current.innerHTML = '';
                    containerRef.current.appendChild(display);
                }
                setIsLoaded(true);
            })
            .catch((err) => {
                console.error('Scramble display error:', err);
                setError(true);
            });

        return () => { cancelled = true; };
    }, [scramble, eventId, visualization]);

    if (error) {
        return (
            <button onClick={onClick} className="relative group cursor-pointer" title="View scramble">
                <div className="w-16 h-16 rounded-xl bg-[#161a23] border border-[#2a2f3a] overflow-hidden">
                    <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs px-1 text-center">
                        {eventId}
                    </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                    <Maximize2 className="w-6 h-6 text-white" />
                </div>
            </button>
        );
    }

    return (
        <button onClick={onClick} className="relative group cursor-pointer" title={visualization === '3d' ? 'View 3D scramble' : 'View 2D scramble'}>
            <div className="w-16 h-16 rounded-xl bg-[#161a23] border border-[#2a2f3a] overflow-hidden hover:border-blue-500/50 transition-colors">
                <div ref={containerRef} className="w-full h-full flex items-center justify-center">
                    {!isLoaded && <Box className="w-6 h-6 text-zinc-600" />}
                </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                <Maximize2 className="w-6 h-6 text-white" />
            </div>
        </button>
    );
}

export default function FloatingScrambleImage({ scramble, eventId, onClick, visualization = '2d', className = '' }) {
    const key = useMemo(() => `${scramble}_${visualization}_${eventId}`, [scramble, visualization, eventId]);

    if (!scramble) {
        return (
            <button onClick={onClick} className={`relative group cursor-pointer ${className}`}>
                <div className="w-16 h-16 rounded-xl bg-[#161a23] border border-[#2a2f3a] overflow-hidden">
                    <Box className="w-6 h-6 text-zinc-600 m-auto mt-4" />
                </div>
            </button>
        );
    }

    return (
        <div className={className}>
            <FloatingScrambleInner key={key} scramble={scramble} eventId={eventId} visualization={visualization} onClick={onClick} />
        </div>
    );
}
