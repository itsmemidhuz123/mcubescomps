// WCA Event IDs supported for scramble generation
export const SUPPORTED_EVENTS = [
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

// Number of scrambles needed per solve (typically 5 for Ao5)
const SCRAMBLE_COUNT = 5;

// Lazy load the cubing module
let randomScrambleForEvent = null;

async function loadCubingModule() {
    if (!randomScrambleForEvent) {
        const cubing = await import("cubing/scramble");
        randomScrambleForEvent = cubing.randomScrambleForEvent;
    }
    return randomScrambleForEvent;
}

/**
 * Generate a single scramble for a specific WCA event
 * @param {string} eventId - WCA event ID (e.g., "333", "444", etc.)
 * @returns {Promise<string>} - The scramble string
 */
export async function generateScramble(eventId) {
    try {
        if (!SUPPORTED_EVENTS.includes(eventId)) {
            throw new Error(`Event ${eventId} is not supported for scramble generation`);
        }

        const scrambleGenerator = await loadCubingModule();
        const scramble = await scrambleGenerator(eventId);
        return scramble.toString();
    } catch (error) {
        console.error(`Error generating scramble for ${eventId}:`, error);
        return null;
    }
}

/**
 * Generate multiple scrambles for a specific event
 * @param {string} eventId - WCA event ID
 * @param {number} count - Number of scrambles to generate (default: 5)
 * @returns {Promise<Object>} - Object with scramble indices as keys
 */
export async function generateScramblesForEvent(eventId, count = SCRAMBLE_COUNT) {
    const scrambles = {};

    try {
        for (let i = 0; i < count; i++) {
            const scramble = await generateScramble(eventId);
            if (scramble) {
                scrambles[i] = scramble;
            }
        }
    } catch (error) {
        console.error(`Error generating scrambles for ${eventId}:`, error);
    }

    return scrambles;
}

/**
 * Generate scrambles for a tournament round
 * @param {Array<string>} eventIds - Array of WCA event IDs
 * @param {number} roundNumber - Round number
 * @param {number} scrambleCount - Number of scrambles per event (default: 5)
 * @returns {Promise<Object>} - Scrambles organized by eventId -> roundNumber -> scrambles
 */
export async function generateRoundScrambles(eventIds, roundNumber, scrambleCount = SCRAMBLE_COUNT) {
    const roundScrambles = {};

    for (const eventId of eventIds) {
        try {
            const eventScrambles = await generateScramblesForEvent(eventId, scrambleCount);

            if (!roundScrambles[eventId]) {
                roundScrambles[eventId] = {};
            }

            roundScrambles[eventId][roundNumber] = eventScrambles;
        } catch (error) {
            console.error(`Error generating scrambles for ${eventId} round ${roundNumber}:`, error);
        }
    }

    return roundScrambles;
}

/**
 * Generate scrambles for an entire tournament (all rounds)
 * @param {Array<string>} eventIds - Array of WCA event IDs
 * @param {Array<Object>} rounds - Array of round objects with roundNumber
 * @param {number} scrambleCount - Number of scrambles per event per round
 * @returns {Promise<Object>} - Complete scramble structure for the tournament
 */
export async function generateTournamentScrambles(eventIds, rounds, scrambleCount = SCRAMBLE_COUNT) {
    const tournamentScrambles = {};

    for (const round of rounds) {
        const roundNum = round.roundNumber;
        const roundScrambles = await generateRoundScrambles(eventIds, roundNum, scrambleCount);

        // Merge round scrambles into tournament scrambles
        for (const eventId of eventIds) {
            if (!tournamentScrambles[eventId]) {
                tournamentScrambles[eventId] = {};
            }

            if (roundScrambles[eventId] && roundScrambles[eventId][roundNum]) {
                tournamentScrambles[eventId][roundNum] = roundScrambles[eventId][roundNum];
            }
        }
    }

    return tournamentScrambles;
}

/**
 * Generate scrambles for standard (non-tournament) competition
 * @param {Array<string>} eventIds - Array of WCA event IDs
 * @param {number} scrambleCount - Number of scrambles per event
 * @returns {Promise<Object>} - Scrambles in flat structure
 */
export async function generateStandardScrambles(eventIds, scrambleCount = SCRAMBLE_COUNT) {
    const scrambles = {};

    for (const eventId of eventIds) {
        try {
            const eventScrambles = await generateScramblesForEvent(eventId, scrambleCount);
            scrambles[eventId] = eventScrambles;
        } catch (error) {
            console.error(`Error generating scrambles for ${eventId}:`, error);
        }
    }

    return scrambles;
}

/**
 * Check if an event is supported for scramble generation
 * @param {string} eventId - WCA event ID
 * @returns {boolean}
 */
export function isEventSupported(eventId) {
    return SUPPORTED_EVENTS.includes(eventId);
}

/**
 * Get list of unsupported events from a selection
 * @param {Array<string>} eventIds - Array of event IDs to check
 * @returns {Array<string>} - List of unsupported event IDs
 */
export function getUnsupportedEvents(eventIds) {
    return eventIds.filter(eventId => !SUPPORTED_EVENTS.includes(eventId));
}

/**
 * Generate scrambles based on competition mode
 * @param {Array<string>} eventIds - Array of WCA event IDs
 * @param {string} mode - Competition mode ('standard' or 'tournament')
 * @param {Array<Object>} rounds - Array of round objects (for tournament mode)
 * @param {number} scrambleCount - Number of scrambles per event
 * @returns {Promise<Object>} - Generated scrambles
 */
export async function generateScrambles(eventIds, mode, rounds = [], scrambleCount = SCRAMBLE_COUNT) {
    // Filter to only supported events
    const supportedEventIds = eventIds.filter(isEventSupported);

    if (supportedEventIds.length === 0) {
        throw new Error('No supported events selected for scramble generation');
    }

    const unsupported = getUnsupportedEvents(eventIds);
    if (unsupported.length > 0) {
        console.warn(`Unsupported events (scrambles not generated): ${unsupported.join(', ')}`);
    }

    if (mode === 'tournament' && rounds.length > 0) {
        return await generateTournamentScrambles(supportedEventIds, rounds, scrambleCount);
    } else {
        return await generateStandardScrambles(supportedEventIds, scrambleCount);
    }
}

export default {
    generateScramble,
    generateScramblesForEvent,
    generateRoundScrambles,
    generateTournamentScrambles,
    generateStandardScrambles,
    generateScrambles,
    isEventSupported,
    getUnsupportedEvents,
    SUPPORTED_EVENTS,
    SCRAMBLE_COUNT
};