import { NextResponse } from 'next/server';
import { randomScrambleForEvent } from 'cubing/scramble';

// WCA Event IDs supported for scramble generation
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

/**
 * Generate a single scramble for a WCA event
 */
async function generateSingleScramble(eventId) {
    try {
        if (!SUPPORTED_EVENTS.includes(eventId)) {
            console.warn(`Event ${eventId} not supported, using 3x3x3`);
            eventId = '333';
        }

        const scramble = await randomScrambleForEvent(eventId);
        return scramble.toString();
    } catch (error) {
        console.error(`Error generating scramble for ${eventId}:`, error);
        return null;
    }
}

/**
 * POST handler for generating scrambles
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { events, rounds, mode, scrambleCount = SCRAMBLE_COUNT } = body;

        // Validate required fields
        if (!events || !Array.isArray(events) || events.length === 0) {
            return NextResponse.json(
                { error: 'Events array is required' },
                { status: 400 }
            );
        }

        // Filter to supported events
        const supportedEvents = events.filter(e => SUPPORTED_EVENTS.includes(e));

        if (supportedEvents.length === 0) {
            return NextResponse.json(
                { error: 'No supported events provided' },
                { status: 400 }
            );
        }

        const scrambles = {};

        if (mode === 'tournament' && rounds && rounds.length > 0) {
            // Tournament mode: generate scrambles for each round
            for (const round of rounds) {
                const roundNum = round.roundNumber || round.roundNumber;

                for (const eventId of supportedEvents) {
                    if (!scrambles[eventId]) {
                        scrambles[eventId] = {};
                    }

                    const eventScrambles = {};
                    for (let i = 0; i < scrambleCount; i++) {
                        const scramble = await generateSingleScramble(eventId);
                        if (scramble) {
                            eventScrambles[i] = scramble;
                        }
                    }

                    scrambles[eventId][roundNum] = eventScrambles;
                }
            }
        } else {
            // Standard mode: generate scrambles for each event
            for (const eventId of supportedEvents) {
                const eventScrambles = {};

                for (let i = 0; i < scrambleCount; i++) {
                    const scramble = await generateSingleScramble(eventId);
                    if (scramble) {
                        eventScrambles[i] = scramble;
                    }
                }

                scrambles[eventId] = eventScrambles;
            }
        }

        return NextResponse.json({
            success: true,
            scrambles,
            eventCount: Object.keys(scrambles).length,
            message: `Generated scrambles for ${Object.keys(scrambles).length} events`
        });

    } catch (error) {
        console.error('Error generating scrambles:', error);
        return NextResponse.json(
            { error: 'Failed to generate scrambles: ' + error.message },
            { status: 500 }
        );
    }
}

/**
 * GET handler - return supported events info
 */
export async function GET() {
    return NextResponse.json({
        supportedEvents: SUPPORTED_EVENTS,
        scrambleCount: SCRAMBLE_COUNT,
        message: 'Send POST with events array, optional rounds array, mode, and scrambleCount'
    });
}