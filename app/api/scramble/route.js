import { NextResponse } from 'next/server';
import { randomScrambleForEvent } from 'cubing/scramble';
import crypto from 'crypto';

const API_KEY = process.env.SCRAMBLE_API_KEY;

const ALLOWED_ORIGINS = [
  'https://mcubesarena.com',
  'https://www.mcubesarena.com',
  'http://localhost:3000',
  'http://localhost:4000',
  'http://127.0.0.1:3000',
];

const ALLOWED_EVENTS = {
  '333': '333',
  '222': '222',
  '444': '444',
  '555': '555',
  '666': '666',
  '777': '777',
  'pyram': 'pyram',
  'skewb': 'skewb',
  'minx': 'minx',
  'sq1': 'sq1',
  'clock': 'clock',
};

function generateScrambleId() {
  return crypto.randomBytes(4).toString('hex');
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const event = searchParams.get('event') || '333';
  const count = parseInt(searchParams.get('count')) || 5;

  if (!ALLOWED_EVENTS[event]) {
    return NextResponse.json(
      { error: 'Invalid event type' },
      { status: 400 }
    );
  }

  try {
    const scrambles = [];
    for (let i = 0; i < Math.min(count, 20); i++) {
      const scramble = await randomScrambleForEvent(ALLOWED_EVENTS[event]);
      scrambles.push(scramble.toString());
    }

    const scrambleId = generateScrambleId();

    return NextResponse.json({
      success: true,
      scrambleId,
      event,
      count: scrambles.length,
      scrambles,
    });
  } catch (error) {
    console.error('Scramble generation error:', error);
    return NextResponse.json(
      { error: 'Scramble generation failed' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const origin = request.headers.get('origin');
  
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json(
      { error: 'Origin not allowed' },
      { status: 403 }
    );
  }

  const apiKey = request.headers.get('x-api-key');
  const isLocalhost = origin && (origin.includes('localhost') || origin.includes('127.0.0.1'));
  
  if (API_KEY && !isLocalhost && apiKey !== API_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { event = '333', count = 5 } = body;

    if (!ALLOWED_EVENTS[event]) {
      return NextResponse.json(
        { error: 'Invalid event type. Allowed: ' + Object.keys(ALLOWED_EVENTS).join(', ') },
        { status: 400 }
      );
    }

    const scrambles = [];
    for (let i = 0; i < Math.min(count, 20); i++) {
      const scramble = await randomScrambleForEvent(ALLOWED_EVENTS[event]);
      scrambles.push(scramble.toString());
    }

    const scrambleId = generateScrambleId();

    return NextResponse.json({
      success: true,
      scrambleId,
      event,
      count: scrambles.length,
      scrambles,
    });
  } catch (error) {
    console.error('Scramble generation error:', error);
    return NextResponse.json(
      { error: 'Scramble generation failed' },
      { status: 500 }
    );
  }
}
