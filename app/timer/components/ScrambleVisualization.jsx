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

function ScrambleDisplayInner({ scramble, eventId, visualization, height }) {
    const containerRef = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const id = useMemo(() => `scramble_${Math.random().toString(36).substr(2, 9)}`, []);

    const puzzle = useMemo(() => EVENT_TO_PUZZLE[eventId] || '3x3x3', [eventId]);
    const displayEvent = useMemo(() => EVENT_TO_DISPLAY[eventId] || '3x3x3', [eventId]);

    useEffect(() => {
        if (!scramble) return;

        let cancelled = false;
        let element = null;

        const init = async () => {
            try {
                const scriptId = visualization === '3d' ? 'twisty-script' : 'scramble-display-script';
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

                // Wait a bit for the module to initialize
                await new Promise(r => setTimeout(r, 100));

                if (cancelled || !containerRef.current) return;

                const container = containerRef.current;

                if (visualization === '3d') {
                    element = document.createElement('twisty-player');
                    element.setAttribute('puzzle', puzzle);
                } else {
                    element = document.createElement('scramble-display');
                    element.setAttribute('event', displayEvent);
                    element.setAttribute('visualization', '2D');
                    element.setAttribute('checkered', 'true');
                }

                element.setAttribute('alg', scramble);
                element.style.width = '100%';
                element.style.height = height;
                element.style.display = 'block';

                container.appendChild(element);
                setIsLoaded(true);
            } catch (err) {
                console.error('Error:', err);
            }
        };

        init();

        return () => {
            cancelled = true;
            // Don't remove element manually - let React handle it
        };
    }, [scramble, puzzle, displayEvent, visualization, height]);

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

export default function ScrambleVisualization({ scramble, eventId, height = '150px', visualization = '2d' }) {
    // Force re-mount when scramble changes to avoid DOM conflicts
    const key = useMemo(() => `${scramble}_${visualization}`, [scramble, visualization]);

    if (!scramble) {
        return (
            <div
                className="w-full flex items-center justify-center bg-transparent rounded-lg overflow-hidden"
                style={{ minHeight: height }}
            >
                <div className="text-zinc-500 text-sm">Loading...</div>
            </div>
        );
    }

    return <ScrambleDisplayInner key={key} scramble={scramble} eventId={eventId} visualization={visualization} height={height} />;
}
