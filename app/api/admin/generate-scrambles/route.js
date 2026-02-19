import { NextResponse } from 'next/server';

import scrambow from 'scrambow';

const { Scrambow } = scrambow;

const SUPPORTED_EVENTS = [
    '333',
    '444',
    '555',
    '666',
    '777',
    '222',
    '333bf',
    '333fm',
    '333oh',
    'clock',
    'minx',
    'pyram',
    'skewb',
    'sq1',
    '444bf',
    '555bf',
    '333mbf',
];

const SCRAMBLE_COUNT = 5;

function normalizeEvent(eventId) {
    // scrambow aliases are generally the same as WCA IDs.
    // Keep this small and explicit in case we need to adjust later.
    return String(eventId || '333');
}

function generateScramblesForEvent(eventId, count) {
    const type = normalizeEvent(eventId);
    const generated = new Scrambow().setType(type).get(count);
    const out = {};
    for (let i = 0; i < count; i++) {
        out[i] = generated?.[i]?.scramble || '';
    }
    return out;
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { events, rounds, mode, scrambleCount = SCRAMBLE_COUNT } = body || {};

        if (!events || !Array.isArray(events) || events.length === 0) {
            return NextResponse.json({ error: 'Events array is required' }, { status: 400 });
        }

        const count = Math.max(1, Math.min(Number(scrambleCount) || SCRAMBLE_COUNT, 50));
        const supportedEvents = events.filter((e) => SUPPORTED_EVENTS.includes(e));
        if (supportedEvents.length === 0) {
            return NextResponse.json({ error: 'No supported events provided' }, { status: 400 });
        }

        const scrambles = {};

        if (mode === 'tournament' && Array.isArray(rounds) && rounds.length > 0) {
            for (const round of rounds) {
                const roundNum = Number(round?.roundNumber);
                if (!Number.isFinite(roundNum)) continue;

                for (const eventId of supportedEvents) {
                    if (!scrambles[eventId]) scrambles[eventId] = {};
                    scrambles[eventId][roundNum] = generateScramblesForEvent(eventId, count);
                }
            }
        } else {
            for (const eventId of supportedEvents) {
                scrambles[eventId] = generateScramblesForEvent(eventId, count);
            }
        }

        return NextResponse.json({ success: true, scrambles });
    } catch (error) {
        console.error('Error generating scrambles:', error);
        return NextResponse.json(
            { error: 'Failed to generate scrambles', details: error?.message || String(error) },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({ supportedEvents: SUPPORTED_EVENTS, scrambleCount: SCRAMBLE_COUNT });
}