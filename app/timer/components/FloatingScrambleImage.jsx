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

function FloatingScrambleInner({ scramble, eventId, visualization, onClick }) {
    const containerRef = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (!scramble) return;

        let cancelled = false;
        let element = null;

        const init = async () => {
            try {
                const scriptId = visualization === '3d' ? 'twisty-script-float' : 'scramble-display-script-float';
                let script = document.getElementById(scriptId);

                if (!script) {
                    script = document.createElement('script');
                    script.id = scriptId;
                    script.src = visualization === '3d'
                        ? 'https://cdn.cubing.net/v0/js/cubing/twisty'
                        : 'https://cdn.cubing.net/v0/js/cubing/scramble-display';
                    script.type = 'module';
                    document.head.appendChild(script);

                    await new Promise((resolve, reject) => {
                        script.onload = resolve;
                        script.onerror = reject;
                    });
                }

                if (cancelled) return;

                await new Promise(r => setTimeout(r, 100));

                if (cancelled || !containerRef.current) return;

                const container = containerRef.current;

                if (visualization === '3d') {
                    element = document.createElement('twisty-player');
                    element.setAttribute('puzzle', EVENT_TO_PUZZLE[eventId] || '3x3x3');
                    element.setAttribute('hint', 'none');
                    element.setAttribute('control-panel', 'none');
                    element.setAttribute('background', 'none');
                    element.setAttribute('animation', 'none');
                } else {
                    element = document.createElement('scramble-display');
                    element.setAttribute('event', EVENT_TO_DISPLAY[eventId] || '3x3x3');
                    element.setAttribute('visualization', '2D');
                    element.setAttribute('checkered', 'true');
                }

                element.setAttribute('alg', scramble);
                element.style.width = '100%';
                element.style.height = '100%';

                container.appendChild(element);
                setIsLoaded(true);
            } catch (err) {
                console.error('Error:', err);
            }
        };

        init();

        return () => {
            cancelled = true;
        };
    }, [scramble, eventId, visualization]);

    return (
        <button
            onClick={onClick}
            className="relative group cursor-pointer"
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

export default function FloatingScrambleImage({
    scramble,
    eventId,
    onClick,
    visualization = '2d',
    className = ''
}) {
    const key = useMemo(() => `${scramble}_${visualization}_${eventId}`, [scramble, visualization, eventId]);

    if (!scramble) {
        return (
            <button
                onClick={onClick}
                className={`relative group cursor-pointer ${className}`}
            >
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
