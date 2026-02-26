'use client';

import { useEffect, useRef, useState } from 'react';
import { ScrambleDisplay } from 'scramble-display';
import { TwistyPlayer } from 'cubing/twisty';

export default function ScrambleDisplayComponent({
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

        const initDisplay = async () => {
            try {
                container.innerHTML = '';

                if (visualization === '2D') {
                    const display = new ScrambleDisplay({
                        event: eventMap[eventId] || '3x3x3',
                        alg: scramble,
                        visualization: '2D',
                        checkered: checkered,
                    });
                    display.style.width = `${width}px`;
                    display.style.height = `${height}px`;
                    display.style.display = 'block';
                    container.appendChild(display);
                } else {
                    const player = new TwistyPlayer({
                        puzzle: eventMap[eventId] || '3x3x3',
                        alg: scramble,
                        background: 'none',
                    });
                    player.style.width = `${width}px`;
                    player.style.height = `${height}px`;
                    container.appendChild(player);
                }

                if (mounted) {
                    setIsLoading(false);
                }
            } catch (err) {
                console.error('ScrambleDisplay error:', err);
                if (mounted) {
                    setHasError(true);
                    setIsLoading(false);
                }
            }
        };

        initDisplay();

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
                    <span className="text-xs text-zinc-500">Loading...</span>
                </div>
            )}

            {hasError && (
                <div
                    className="bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-500 text-xs p-2 text-center"
                    style={{ width: `${width}px`, height: `${height}px` }}
                >
                    Preview unavailable
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