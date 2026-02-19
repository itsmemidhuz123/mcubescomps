'use client';

import { useState, useCallback } from 'react';

const SUPPORTED_EVENTS = [
    "333",    // 3x3x3 Cube
    "444",    // 4x4x4 Cube
    "555",    // 5x5x5 Cube
    "666",    // 6x6x6 Cube
    "777",    // 7x7x7 Cube
    "222",    // 2x2x2 Cube
    "333bf",  // 3x3x3 Blindfolded
    "333fm",  // 3x3x3 Fewest Moves
    "333oh",  // 3x3x3 One-Handed
    "clock",  // Clock
    "minx",   // Megaminx
    "pyram",  // Pyraminx
    "skewb",  // Skewb
    "sq1",    // Square-1
    "444bf",  // 4x4x4 Blindfolded
    "555bf",  // 5x5x5 Blindfolded
    "333mbf", // 3x3x3 Multi-Blindfolded
];

const SCRAMBLE_COUNT = 5;

// Map WCA event IDs to cubing.js event names
const EVENT_MAP = {
    '333': '333',
    '444': '444',
    '555': '555',
    '666': '666',
    '777': '777',
    '222': '222',
    '333bf': '333bf',
    '333fm': '333fm',
    '333oh': '333oh',
    'clock': 'clock',
    'minx': 'minx',
    'pyram': 'pyram',
    'skewb': 'skewb',
    'sq1': 'sq1',
    '444bf': '444bf',
    '555bf': '555bf',
    '333mbf': '333mbf',
};

/**
 * Generate scrambles using cubing.js CDN
 * This runs entirely in the browser
 */
export function useCubingScrambleGenerator() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    /**
     * Generate a single scramble for an event using cubing.js
     */
    const generateSingleScramble = useCallback(async (eventId) => {
        try {
            // Dynamically import cubing.js from CDN
            const { randomScrambleForEvent } = await import('https://cdn.cubing.net/v0/js/cubing/scramble');

            const cubingEvent = EVENT_MAP[eventId] || '333';
            const scramble = await randomScrambleForEvent(cubingEvent);
            return scramble.toString();
        } catch (err) {
            console.error(`Error generating scramble for ${eventId}:`, err);
            return null;
        }
    }, []);

    /**
     * Generate multiple scrambles for multiple events
     * @param {string[]} events - Array of event IDs
     * @param {number} scrambleCount - Number of scrambles per event
     * @param {Function} onProgress - Progress callback (current, total)
     */
    const generateScrambles = useCallback(async (events, scrambleCount = SCRAMBLE_COUNT, onProgress = null) => {
        setIsLoading(true);
        setError(null);

        const supportedEvents = events.filter(e => SUPPORTED_EVENTS.includes(e));
        const scrambles = {};
        let current = 0;
        const total = supportedEvents.length * scrambleCount;

        try {
            for (const eventId of supportedEvents) {
                scrambles[eventId] = {};

                for (let i = 0; i < scrambleCount; i++) {
                    const scramble = await generateSingleScramble(eventId);
                    if (scramble) {
                        scrambles[eventId][i] = scramble;
                    }
                    current++;
                    if (onProgress) {
                        onProgress(current, total);
                    }
                }
            }

            return scrambles;
        } catch (err) {
            setError(err.message);
            console.error('Error generating scrambles:', err);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [generateSingleScramble]);

    return {
        generateScrambles,
        generateSingleScramble,
        isLoading,
        error,
        supportedEvents: SUPPORTED_EVENTS
    };
}

/**
 * Generate a single scramble (non-hook version for simple usage)
 */
export async function generateScrambleWithCubing(eventId) {
    try {
        const { randomScrambleForEvent } = await import('https://cdn.cubing.net/v0/js/cubing/scramble');
        const cubingEvent = EVENT_MAP[eventId] || '333';
        const scramble = await randomScrambleForEvent(cubingEvent);
        return scramble.toString();
    } catch (err) {
        console.error('Error generating scramble:', err);
        return null;
    }
}

/**
 * Check if an event is supported
 */
export function isEventSupported(eventId) {
    return SUPPORTED_EVENTS.includes(eventId);
}

/**
 * Get unsupported events from a list
 */
export function getUnsupportedEvents(eventIds) {
    return eventIds.filter(e => !SUPPORTED_EVENTS.includes(e));
}

export { SUPPORTED_EVENTS, SCRAMBLE_COUNT };