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

// Move definitions for different puzzles
const CUBE_MOVES = ['R', 'L', 'U', 'D', 'F', 'B'];
const CUBE_MODIFIERS = ['', "'", '2'];
const CUBE_MOVES_EXTENDED = ['R', 'L', 'U', 'D', 'F', 'B', 'M', 'E', 'S'];
const SQUARE1_MOVES = ['/', '(', ')', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
const PYRAMID_MOVES = ['U', 'L', 'R', 'B', 'u', 'l', 'r', 'b'];
const CLOCK_MOVES = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL', 'u', 'r', 'd', 'l', 'y', 'x'];

/**
 * Generate a random integer between min and max (inclusive)
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get random element from array
 */
function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a cube scramble (3x3, 4x4, 5x5, etc.)
 */
function generateCubeScramble(length = 25, extended = false) {
    const moves = extended ? CUBE_MOVES_EXTENDED : CUBE_MOVES;
    const scramble = [];
    let lastMove = '';
    let secondLastMove = '';

    for (let i = 0; i < length; i++) {
        let move = randomElement(moves);

        // Avoid same face moves in a row
        while (move === lastMove || (move === secondLastMove && getFace(move) === getFace(lastMove))) {
            move = randomElement(moves);
        }

        const modifier = randomElement(CUBE_MODIFIERS);
        scramble.push(move + modifier);

        secondLastMove = lastMove;
        lastMove = move;
    }

    return scramble.join(' ');
}

/**
 * Get the face of a move
 */
function getFace(move) {
    return move.replace(/[2']/g, '');
}

/**
 * Generate 2x2 scramble
 */
function generate222Scramble() {
    return generateCubeScramble(25, false);
}

/**
 * Generate 3x3 scramble
 */
function generate333Scramble() {
    return generateCubeScramble(25, false);
}

/**
 * Generate 4x4 scramble
 */
function generate444Scramble() {
    return generateCubeScramble(40, true);
}

/**
 * Generate 5x5 scramble
 */
function generate555Scramble() {
    return generateCubeScramble(40, true);
}

/**
 * Generate 6x6 scramble
 */
function generate666Scramble() {
    return generateCubeScramble(45, true);
}

/**
 * Generate 7x7 scramble
 */
function generate777Scramble() {
    return generateCubeScramble(45, true);
}

/**
 * Generate blindfolded scramble (3x3, 4x4, 5x5)
 */
function generateBFScramble(cubeSize = 3) {
    const length = cubeSize === 3 ? 25 : cubeSize === 4 ? 40 : 45;
    return generateCubeScramble(length, cubeSize > 3);
}

/**
 * Generate 3x3 OH scramble
 */
function generate333ohScramble() {
    return generateCubeScramble(25, false);
}

/**
 * Generate fewest moves scramble (3x3)
 */
function generate333fmScramble() {
    return generateCubeScramble(30, false);
}

/**
 * Generate Square-1 scramble
 */
function generateSquare1Scramble() {
    const scramble = [];
    let lastMove = '';

    for (let i = 0; i < 30; i++) {
        let move = randomElement(SQUARE1_MOVES);

        while (move === lastMove) {
            move = randomElement(SQUARE1_MOVES);
        }

        scramble.push(move);
        lastMove = move;
    }

    return scramble.join(' ');
}

/**
 * Generate Pyraminx scramble
 */
function generatePyraminxScramble() {
    const scramble = [];
    let lastMove = '';

    for (let i = 0; i < 25; i++) {
        let move = randomElement(PYRAMID_MOVES);

        while (move === lastMove) {
            move = randomElement(PYRAMID_MOVES);
        }

        scramble.push(move);
        lastMove = move;
    }

    return scramble.join(' ');
}

/**
 * Generate Skewb scramble
 */
function generateSkewbScramble() {
    const skewbMoves = ['R', 'L', 'U', 'D', 'B'];
    const scramble = [];
    let lastMove = '';

    for (let i = 0; i < 25; i++) {
        let move = randomElement(skewbMoves);

        while (move === lastMove) {
            move = randomElement(skewbMoves);
        }

        const modifier = randomElement(['', "'"]);
        scramble.push(move + modifier);
        lastMove = move;
    }

    return scramble.join(' ');
}

/**
 * Generate Clock scramble
 */
function generateClockScramble() {
    const scramble = [];
    let lastMove = '';

    for (let i = 0; i < 30; i++) {
        let move = randomElement(CLOCK_MOVES);

        while (move === lastMove) {
            move = randomElement(CLOCK_MOVES);
        }

        // Add +/- and number
        const sign = randomElement(['+', '-']);
        const num = randomInt(1, 11);
        scramble.push(move + sign + num);
        lastMove = move;
    }

    return scramble.join(' ');
}

/**
 * Generate Megaminx scramble
 */
function generateMegaminxScramble() {
    const moves = ['R++', 'R--', 'L++', 'L--', 'U++', 'U--', 'D++', 'D--', 'F++', 'F--', 'B++', 'B--'];
    const scramble = [];
    let lastMove = '';

    for (let i = 0; i < 35; i++) {
        let move = randomElement(moves);

        // Avoid consecutive moves on same face
        const face = move.charAt(0);
        while (lastMove && lastMove.charAt(0) === face) {
            move = randomElement(moves);
        }

        scramble.push(move);
        lastMove = move;
    }

    return scramble.join(' ');
}

/**
 * Generate Multi-BF scramble (3x3)
 */
function generate333mbfScramble() {
    // Multi-blind is just multiple 3x3 scrambles separated
    const scrambles = [];
    for (let i = 0; i < 3; i++) {
        scrambles.push(generateCubeScramble(25, false));
    }
    return scrambles.join(' |\n');
}

/**
 * Main scramble generation function
 * @param {string} eventId - WCA event ID
 * @returns {string} - The scramble string
 */
export function generateScramble(eventId) {
    try {
        if (!SUPPORTED_EVENTS.includes(eventId)) {
            console.warn(`Event ${eventId} not supported, generating 3x3 scramble`);
        }

        switch (eventId) {
            case '222':
                return generate222Scramble();
            case '333':
                return generate333Scramble();
            case '444':
                return generate444Scramble();
            case '555':
                return generate555Scramble();
            case '666':
                return generate666Scramble();
            case '777':
                return generate777Scramble();
            case '333bf':
            case '444bf':
            case '555bf':
                return generateBFScramble(eventId === '444bf' ? 4 : eventId === '555bf' ? 5 : 3);
            case '333fm':
                return generate333fmScramble();
            case '333oh':
                return generate333ohScramble();
            case 'sq1':
                return generateSquare1Scramble();
            case 'pyram':
                return generatePyraminxScramble();
            case 'skewb':
                return generateSkewbScramble();
            case 'clock':
                return generateClockScramble();
            case 'minx':
                return generateMegaminxScramble();
            case '333mbf':
                return generate333mbfScramble();
            default:
                return generate333Scramble();
        }
    } catch (error) {
        console.error(`Error generating scramble for ${eventId}:`, error);
        return null;
    }
}

/**
 * Generate multiple scrambles for a specific event
 * @param {string} eventId - WCA event ID
 * @param {number} count - Number of scrambles to generate (default: 5)
 * @returns {Object} - Object with scramble indices as keys
 */
export function generateScramblesForEvent(eventId, count = SCRAMBLE_COUNT) {
    const scrambles = {};

    for (let i = 0; i < count; i++) {
        const scramble = generateScramble(eventId);
        if (scramble) {
            scrambles[i] = scramble;
        }
    }

    return scrambles;
}

/**
 * Generate scrambles for a tournament round
 * @param {Array<string>} eventIds - Array of WCA event IDs
 * @param {number} roundNumber - Round number
 * @param {number} scrambleCount - Number of scrambles per event (default: 5)
 * @returns {Object} - Scrambles organized by eventId -> roundNumber -> scrambles
 */
export function generateRoundScrambles(eventIds, roundNumber, scrambleCount = SCRAMBLE_COUNT) {
    const roundScrambles = {};

    for (const eventId of eventIds) {
        const eventScrambles = generateScramblesForEvent(eventId, scrambleCount);
        roundScrambles[eventId] = {};
        roundScrambles[eventId][roundNumber] = eventScrambles;
    }

    return roundScrambles;
}

/**
 * Generate scrambles for an entire tournament (all rounds)
 * @param {Array<string>} eventIds - Array of WCA event IDs
 * @param {Array<Object>} rounds - Array of round objects with roundNumber
 * @param {number} scrambleCount - Number of scrambles per event per round
 * @returns {Object} - Complete scramble structure for the tournament
 */
export function generateTournamentScrambles(eventIds, rounds, scrambleCount = SCRAMBLE_COUNT) {
    const tournamentScrambles = {};

    for (const round of rounds) {
        const roundNum = round.roundNumber;
        const roundScrambles = generateRoundScrambles(eventIds, roundNum, scrambleCount);

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
 * @returns {Object} - Scrambles in flat structure
 */
export function generateStandardScrambles(eventIds, scrambleCount = SCRAMBLE_COUNT) {
    const scrambles = {};

    for (const eventId of eventIds) {
        scrambles[eventId] = generateScramblesForEvent(eventId, scrambleCount);
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
 * @returns {Object} - Generated scrambles
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
        return generateTournamentScrambles(supportedEventIds, rounds, scrambleCount);
    } else {
        return generateStandardScrambles(supportedEventIds, scrambleCount);
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