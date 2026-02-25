import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { event } = await request.json();

        if (!event) {
            return NextResponse.json({ error: 'Event is required' }, { status: 400 });
        }

        const cubing = await import('cubing/scramble');
        const alg = await cubing.randomScrambleForEvent(event);
        const scramble = alg ? alg.toString() : '';

        return NextResponse.json({ scramble });
    } catch (error) {
        console.error('Scramble generation error:', error);
        return NextResponse.json({ error: 'Failed to generate scramble', details: error.message }, { status: 500 });
    }
}

export async function GET(request) {
    return NextResponse.json({
        message: 'Use POST to generate scrambles',
        events: ['222', '333', '444', '555', '666', '777', 'pyram', 'skewb', 'sq1', 'clock', 'minx']
    });
}