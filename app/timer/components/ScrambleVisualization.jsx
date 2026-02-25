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
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);
    const [loadingTimeout, setLoadingTimeout] = useState(false);
    const elementRef = useRef(null);

    const puzzle = useMemo(() => EVENT_TO_PUZZLE[eventId] || '3x3x3', [eventId]);

    useEffect(() => {
        if (!scramble) return;

        let cancelled = false;

        const timeoutId = setTimeout(() => {
            if (!cancelled && !isLoaded) {
                setLoadingTimeout(true);
            }
        }, 8000);

        const init = async () => {
            setError(false);
            setLoadingTimeout(false);
            setIsLoaded(false);

            try {
                const scriptId = 'cubing-twisty-script';
                let script = document.getElementById(scriptId);

                if (!script) {
                    script = document.createElement('script');
                    script.id = scriptId;
                    script.src = 'https://cdn.cubing.net/v0/js/cubing/twisty';
                    script.type = 'module';
                    document.head.appendChild(script);

                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('Script load timeout')), 15000);
                        script.onload = () => {
                            clearTimeout(timeout);
                            resolve();
                        };
                        script.onerror = () => {
                            clearTimeout(timeout);
                            reject(new Error('Script load failed'));
                        };
                    });
                }

                if (cancelled) return;

                await new Promise(r => setTimeout(r, 300));

                if (cancelled || !containerRef.current) return;

                const container = containerRef.current;

                if (elementRef.current) {
                    container.removeChild(elementRef.current);
                    elementRef.current = null;
                }

                const element = document.createElement('twisty-player');
                element.setAttribute('puzzle', puzzle);
                element.setAttribute('alg', scramble);
                element.setAttribute('visualization', visualization === '3d' ? '3D' : '2D');
                element.setAttribute('background', 'none');
                element.setAttribute('hint-facelets', 'none');
                if (visualization === '2d') {
                    element.setAttribute('control-panel', 'none');
                }
                element.style.width = '100%';
                element.style.height = height;
                element.style.display = 'block';

                container.appendChild(element);
                elementRef.current = element;

                setTimeout(() => {
                    if (!cancelled) setIsLoaded(true);
                }, 500);
            } catch (err) {
                console.error('Scramble display error:', err);
                if (!cancelled) {
                    setError(true);
                    setLoadingTimeout(true);
                }
            }
        };

        init();

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [scramble, puzzle, visualization, height, isLoaded]);

    if (error || loadingTimeout) {
        return (
            <div
                className="w-full flex flex-col items-center justify-center bg-[#161a23] rounded-lg overflow-hidden border border-[#2a2f3a] p-3"
                style={{ minHeight: height }}
            >
                <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">{EVENT_TO_PUZZLE[eventId] || eventId}</div>
                <div className="text-zinc-300 text-sm font-mono text-center break-all px-2">{scramble}</div>
            </div>
        );
    }

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
    const key = useMemo(() => `${scramble}_${visualization}_${eventId}`, [scramble, visualization, eventId]);

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
