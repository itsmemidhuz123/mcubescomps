'use client';

import { useState, useCallback } from 'react';
import { Scrambow } from 'scrambow';

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

// Map WCA event IDs to scrambow type names
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
 * Generate scrambles using scrambow npm package
 * Pure JavaScript - works in both Node.js and browser
 */
export function useScrambowGenerator() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    /**
     * Generate a single scramble for an event
     */
    const generateSingleScramble = useCallback((eventId) => {
        try {
            const scrambowType = EVENT_MAP[eventId] || '333';
            const scramble = new Scrambow()
                .setType(scrambowType)
                .get(1);

            if (scramble && scramble.length > 0) {
                return scramble[0].scramble;
            }
            return null;
        } catch (err) {
            console.error(`Error generating scramble for ${eventId}:`, err);
            return null;
        }
    }, []);

    /**
     * Generate multiple scrambles for multiple events
     */
    const generateScrambles = useCallback((events, scrambleCount = SCRAMBLE_COUNT, onProgress = null) => {
        setIsLoading(true);
        setError(null);

        const supportedEvents = events.filter(e => SUPPORTED_EVENTS.includes(e));
        const scrambles = {};
        let current = 0;
        const total = supportedEvents.length * scrambleCount;

        try {
            for (const eventId of supportedEvents) {
                scrambles[eventId] = {};

                const scrambowType = EVENT_MAP[eventId] || '333';
                const generated = new Scrambow()
                    .setType(scrambowType)
                    .get(scrambleCount);

                for (let i = 0; i < scrambleCount; i++) {
                    if (generated && generated[i]) {
                        scrambles[eventId][i] = generated[i].scramble;
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
    }, []);

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
export function generateScrambleWithScrambow(eventId) {
    try {
        const scrambowType = EVENT_MAP[eventId] || '333';
        const scramble = new Scrambow()
            .setType(scrambowType)
            .get(1);

        if (scramble && scramble.length > 0) {
            return scramble[0].scramble;
        }
        return null;
    } catch (err) {
        console.error('Error generating scramble:', err);
        return null;
    }
}

/**
 * Generate multiple scrambles for an event
 */
export function generateMultipleScrambles(eventId, count = SCRAMBLE_COUNT) {
    try {
        const scrambowType = EVENT_MAP[eventId] || '333';
        const scrambles = new Scrambow()
            .setType(scrambowType)
            .get(count);

        const result = {};
        for (let i = 0; i < count; i++) {
            if (scrambles && scrambles[i]) {
                result[i] = scrambles[i].scramble;
            }
        }
        return result;
    } catch (err) {
        console.error('Error generating scrambles:', err);
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