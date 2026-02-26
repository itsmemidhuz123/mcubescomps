'use client';

import { useEffect, useRef, useState } from 'react';

export default function ScrambleDisplay({
    eventId,
    scramble,
    visualization = "3D",
    width = 200,
    height = 200,
    checkered = true,
    className = ''
}) {
    const containerRef = useRef(null);
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

    useEffect(() => {
        if (!containerRef.current || !scramble) {
            setIsLoading(false);
            return;
        }

        let mounted = true;
        const container = containerRef.current;

        const loadScript = async () => {
            const scriptId = 'scramble-display-lib';

            if (!document.getElementById(scriptId)) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.id = scriptId;
                    script.src = 'https://cdn.cubing.net/v0/js/scramble-display';
                    script.type = 'module';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            if (!mounted || !container) return;

            container.innerHTML = '';

            const display = document.createElement('scramble-display');
            display.setAttribute('event', eventMap[eventId] || '3x3x3');
            display.setAttribute('alg', scramble);
            display.setAttribute('visualization', visualization);
            display.setAttribute('checkered', checkered ? 'true' : 'false');
            display.style.width = `${width}px`;
            display.style.height = `${height}px`;
            display.style.display = 'block';

            container.appendChild(display);

            setTimeout(() => {
                if (mounted) setIsLoading(false);
            }, 500);
        };

        loadScript().catch(() => {
            if (mounted) {
                setHasError(true);
                setIsLoading(false);
            }
        });

        return () => {
            mounted = false;
        };
    }, [eventId, scramble, visualization, width, height, checkered]);

    if (!scramble) {
        return (
            <div
                className={`bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-500 text-sm ${className}`}
                style={{ width: `${width}px`, height: `${height}px` }}
            >
                No scramble
            </div>
        );
    }

    return (
        <div
            className={`relative ${className}`}
            style={{ width: `${width}px`, height: `${height}px` }}
        >
            {isLoading && (
                <div
                    className="absolute inset-0 bg-zinc-900 rounded-lg flex items-center justify-center z-10"
                    style={{ width: `${width}px`, height: `${height}px` }}
                >
                    <span className="text-xs text-zinc-500">Loading 3D...</span>
                </div>
            )}

            {hasError && (
                <div
                    className="bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-500 text-xs p-2 text-center"
                    style={{ width: `${width}px`, height: `${height}px` }}
                >
                    3D preview unavailable
                </div>
            )}

            <div
                ref={containerRef}
                style={{
                    width: `${width}px`,
                    height: `${height}px`,
                    opacity: isLoading ? 0 : 1,
                }}
            />
        </div>
    );
}