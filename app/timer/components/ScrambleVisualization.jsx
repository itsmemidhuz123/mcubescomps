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

function ScrambleDisplayInner({ scramble, eventId, visualization, height }) {
    const containerRef = useRef(null);
    const [vizLoaded, setVizLoaded] = useState(false);
    const elementRef = useRef(null);

    const puzzle = useMemo(() => EVENT_TO_PUZZLE[eventId] || '3x3x3', [eventId]);

    useEffect(() => {
        if (!scramble || !containerRef.current) return;

        const container = containerRef.current;

        const cleanup = () => {
            if (elementRef.current) {
                try {
                    container.removeChild(elementRef.current);
                } catch (e) { }
                elementRef.current = null;
            }
        };

        cleanup();

        const tryLoadVisualization = async () => {
            try {
                const scriptId = 'cubing-twisty-script';
                let script = document.getElementById(scriptId);

                if (!script) {
                    script = document.createElement('script');
                    script.id = scriptId;
                    script.src = 'https://cdn.cubing.net/v0/js/cubing/twisty';
                    script.type = 'module';
                    script.crossOrigin = 'anonymous';

                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('timeout')), 10000);
                        script.onload = () => {
                            clearTimeout(timeout);
                            resolve();
                        };
                        script.onerror = () => {
                            clearTimeout(timeout);
                            reject(new Error('load error'));
                        };
                    });
                }

                await new Promise(r => setTimeout(r, 300));

                if (!containerRef.current) return;

                const element = document.createElement('twisty-player');
                element.setAttribute('puzzle', puzzle);
                element.setAttribute('alg', scramble);
                element.setAttribute('visualization', visualization === '3d' ? '3D' : '2D');
                element.setAttribute('background', 'none');
                element.setAttribute('hint-facelets', 'none');
                element.style.width = '100%';
                element.style.height = height;

                containerRef.current.appendChild(element);
                elementRef.current = element;

                setVizLoaded(true);
            } catch (err) {
                console.log('Visualization not available:', err.message);
            }
        };

        tryLoadVisualization();

        return cleanup;
    }, [scramble, puzzle, visualization, height]);

    return (
        <div className="space-y-2">
            <div
                ref={containerRef}
                className="w-full flex items-center justify-center bg-zinc-900/50 rounded-lg overflow-hidden"
                style={{ minHeight: height }}
            >
                {!vizLoaded && (
                    <div className="text-zinc-500 text-sm py-4">Loading visualization...</div>
                )}
            </div>
            <div className="text-center">
                <span className="text-zinc-400 text-xs uppercase tracking-wider mr-2">{EVENT_TO_PUZZLE[eventId] || eventId}</span>
                <span className="text-zinc-300 text-sm font-mono">{scramble}</span>
            </div>
        </div>
    );
}

export default function ScrambleVisualization({ scramble, eventId, height = '150px', visualization = '2d' }) {
    const key = useMemo(() => `${scramble}_${visualization}_${eventId}`, [scramble, visualization, eventId]);

    if (!scramble) {
        return (
            <div
                className="w-full flex items-center justify-center bg-transparent rounded-lg"
                style={{ minHeight: height }}
            >
                <div className="text-zinc-500 text-sm">Loading...</div>
            </div>
        );
    }

    return <ScrambleDisplayInner key={key} scramble={scramble} eventId={eventId} visualization={visualization} height={height} />;
}
