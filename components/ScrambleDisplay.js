'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Scramble Display Component
 * Renders a visual representation of a scramble using cubing.js scramble-display
 * 
 * @param {Object} props
 * @param {string} props.eventId - WCA event ID (e.g., "333", "444", "pyram")
 * @param {string} props.scramble - The scramble notation string
 * @param {string} props.visualization - "2D" or "3D" (default: "2D")
 * @param {number} props.width - Width in pixels (default: 200)
 * @param {number} props.height - Height in pixels (default: 200)
 * @param {boolean} props.checkered - Show checkered pattern for orientation (default: true)
 */
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

    // Map WCA event IDs to scramble-display event names
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

    // Check if visualization is supported for this event
    const isVisualizationSupported = (eventId, viz) => {
        if (viz === '2D') {
            // 2D is only supported for 3x3x3 currently
            return ['333', '333bf', '333oh', '333fm', '333mbf'].includes(eventId);
        }
        // 3D is supported for all events
        return true;
    };

    useEffect(() => {
        if (!containerRef.current || !scramble) {
            setIsLoading(false);
            return;
        }

        const loadScrambleDisplay = async () => {
            setIsLoading(true);
            setHasError(false);

            try {
                // Load the scramble-display module from the CDN at runtime.
                // webpackIgnore prevents Next/webpack from trying to bundle the URL.
                await import(/* webpackIgnore: true */ 'https://cdn.cubing.net/v0/js/cubing/scramble-display');

                // Clear previous display
                if (scrambleDisplayRef.current) {
                    scrambleDisplayRef.current.remove();
                }

                // Determine the actual visualization to use
                const effectiveVisualization = isVisualizationSupported(eventId, visualization)
                    ? visualization
                    : '3D';

                // Create new scramble display element
                const display = document.createElement('scramble-display');
                display.setAttribute('event', eventMap[eventId] || '3x3x3');
                display.setAttribute('scramble', scramble);
                display.setAttribute('visualization', effectiveVisualization);
                display.setAttribute('checkered', checkered ? 'true' : 'false');
                display.style.width = `${width}px`;
                display.style.height = `${height}px`;
                display.style.display = 'block';

                // Add load event listener
                display.addEventListener('load', () => {
                    setIsLoading(false);
                });

                scrambleDisplayRef.current = display;
                containerRef.current.appendChild(display);

                // Set a timeout to hide loading if load event doesn't fire
                setTimeout(() => {
                    setIsLoading(false);
                }, 2000);

            } catch (error) {
                console.error('Error loading scramble display:', error);
                setHasError(true);
                setIsLoading(false);
            }
        };

        loadScrambleDisplay();

        return () => {
            if (scrambleDisplayRef.current && containerRef.current) {
                try {
                    containerRef.current.removeChild(scrambleDisplayRef.current);
                } catch (e) {
                    // Element might already be removed
                }
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
            {/* Loading Overlay */}
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

            {/* Error State */}
            {hasError && (
                <div
                    className="bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs p-2 text-center"
                    style={{ width: `${width}px`, height: `${height}px` }}
                >
                    Unable to load visualization
                </div>
            )}

            {/* Scramble Display Container */}
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