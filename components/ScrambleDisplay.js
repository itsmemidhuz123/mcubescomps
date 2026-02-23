'use client';

import { useEffect, useRef, useState } from 'react';

export default function ScrambleDisplay({
    eventId,
    scramble,
    visualization = "3D",
    width = 200,
    height = 200,
    checkered = true
}) {
    const containerRef = useRef(null);
    const scrambleDisplayRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const eventMap = {
        '333': '3x3x3',
        '444': '4x4x4',
        '555': '5x5x5',
        '666': '6x6x6',
        '777': '7x7x7',
        '222': '2x2x2',
        '333bf': '3x3x3',
        '333oh': '3x3x3',
        '333fm': '3x3x3',
        'clock': 'clock',
        'minx': 'megaminx',
        'pyram': 'pyraminx',
        'skewb': 'skewb',
        'sq1': 'square1',
        '444bf': '4x4x4',
        '555bf': '5x5x5',
        '333mbf': '3x3x3',
    };

    const isVisualizationSupported = (eventId, viz) => {
        if (viz === '2D') {
            return ['333', '333bf', '333oh', '333fm', '333mbf'].includes(eventId);
        }
        return true;
    };

    useEffect(() => {
        if (!containerRef.current || !scramble) {
            setIsLoading(false);
            return;
        }

        const container = containerRef.current;
        let mounted = true;

        const loadScrambleDisplay = async () => {
            setIsLoading(true);
            setHasError(false);

            try {
                await import(/* webpackIgnore: true */ 'https://cdn.cubing.net/v0/js/cubing/scramble-display');

                if (!mounted) return;

                if (scrambleDisplayRef.current) {
                    scrambleDisplayRef.current.remove();
                }

                const effectiveVisualization = isVisualizationSupported(eventId, visualization)
                    ? visualization
                    : '3D';

                const display = document.createElement('scramble-display');
                display.setAttribute('event', eventMap[eventId] || '3x3x3');
                display.setAttribute('scramble', scramble);
                display.setAttribute('visualization', effectiveVisualization);
                display.setAttribute('checkered', checkered ? 'true' : 'false');
                display.style.width = `${width}px`;
                display.style.height = `${height}px`;
                display.style.display = 'block';

                display.addEventListener('load', () => {
                    if (mounted) setIsLoading(false);
                });

                scrambleDisplayRef.current = display;
                container.appendChild(display);

                setTimeout(() => {
                    if (mounted) setIsLoading(false);
                }, 2000);

            } catch (error) {
                console.error('Error loading scramble display:', error);
                if (mounted) {
                    setHasError(true);
                    setIsLoading(false);
                }
            }
        };

        loadScrambleDisplay();

        return () => {
            mounted = false;
            if (scrambleDisplayRef.current && scrambleDisplayRef.current.parentNode) {
                scrambleDisplayRef.current.remove();
                scrambleDisplayRef.current = null;
            }
        };
    }, [eventId, scramble, visualization, width, height, checkered]);

    if (!scramble) {
        return (
            <div
                className="bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm"
                style={{ width: `${width}px`, height: `${height}px` }}
            >
                No scramble
            </div>
        );
    }

    return (
        <div
            className="relative"
            style={{ width: `${width}px`, height: `${height}px` }}
        >
            {isLoading && (
                <div
                    className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center z-10"
                    style={{ width: `${width}px`, height: `${height}px` }}
                >
                    <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                        <span className="text-xs text-gray-500">Loading...</span>
                    </div>
                </div>
            )}

            {hasError && (
                <div
                    className="bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs p-2 text-center"
                    style={{ width: `${width}px`, height: `${height}px` }}
                >
                    Unable to load visualization
                </div>
            )}

            <div
                ref={containerRef}
                className="scramble-display-container"
                style={{
                    width: `${width}px`,
                    height: `${height}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isLoading ? 0 : 1,
                    transition: 'opacity 0.3s ease'
                }}
            />
        </div>
    );
}