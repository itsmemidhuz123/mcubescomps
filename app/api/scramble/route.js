import { NextResponse } from 'next/server';

const SCRAMBLE_LENGTHS = {
    '333': 20,
    '222': 11,
    '444': 40,
    '555': 60,
    '666': 80,
    '777': 100,
    'pyram': 11,
    'skewb': 11,
    'sq1': 40,
    'clock': 15,
    'minx': 70
};

const MOVES_333 = ['R', 'L', 'U', 'D', 'F', 'B'];
const MODIFIERS = ['', "'", '2'];

const MOVES_PYRAM = ['R', 'L', 'U', 'B'];
const MOVES_SKEWB = ['R', 'L', 'U', 'B'];
const MOVES_SQ1 = ['R', 'L', 'U', 'D'];
const MOVES_CLOCK = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'];

function generate333Scramble(length = 20) {
    const scramble = [];
    let lastFace = '';
    let secondLastFace = '';

    for (let i = 0; i < length; i++) {
        const validFaces = MOVES_333.filter(f => f !== lastFace && f !== secondLastFace);
        const face = validFaces[Math.floor(Math.random() * validFaces.length)];
        const modifier = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];

        scramble.push(face + modifier);
        secondLastFace = lastFace;
        lastFace = face;
    }

    return scramble.join(' ');
}

function generatePyraminxScramble(length = 11) {
    const scramble = [];
    let lastMove = '';

    for (let i = 0; i < length; i++) {
        const validMoves = MOVES_PYRAM.filter(m => m !== lastMove);
        const move = validMoves[Math.floor(Math.random() * validMoves.length)];
        const modifier = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];

        scramble.push(move + modifier);
        lastMove = move;
    }

    return scramble.join(' ');
}

function generateSkewbScramble(length = 11) {
    const scramble = [];
    let lastMove = '';

    for (let i = 0; i < length; i++) {
        const validMoves = MOVES_SKEWB.filter(m => m !== lastMove);
        const move = validMoves[Math.floor(Math.random() * validMoves.length)];
        const modifier = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];

        scramble.push(move + modifier);
        lastMove = move;
    }

    return scramble.join(' ');
}

function generateClockScramble(length = 15) {
    const scramble = [];

    for (let i = 0; i < length; i++) {
        const move = MOVES_CLOCK[Math.floor(Math.random() * MOVES_CLOCK.length)];
        const modifier = Math.floor(Math.random() * 12) - 6;

        if (move === 'ALL') {
            scramble.push(`ALL${modifier > 0 ? '+' + modifier : modifier}`);
        } else {
            scramble.push(`${move}${modifier > 0 ? '+' + modifier : modifier}`);
        }
    }

    return scramble.join(' ');
}

function generateSq1Scramble(length = 40) {
    const scramble = [];
    let parenDepth = 0;

    for (let i = 0; i < length; i++) {
        const move = Math.floor(Math.random() * 11) - 5;
        const slash = Math.random() > 0.7 ? '/' : '';

        if (slash === '/' && paren_depth > 0) {
            scramble.push(')');
            paren_depth--;
        }

        scramble.push(move + slash);

        if (slash === '/' && Math.random() > 0.5 && paren_depth < 2) {
            scramble.push('(');
            paren_depth++;
        }
    }

    while (paren_depth > 0) {
        scramble.push(')');
        paren_depth--;
    }

    return scramble.join(' ');
}

function generateBigCubeScramble(length) {
    const innerMoves = ['R', 'L', 'U', 'D', 'F', 'B'];
    const outerMoves = ['R', 'L', 'U', 'D', 'F', 'B'];
    const slices = ['', '2', 'w'];

    const scramble = [];
    let lastFace = '';

    for (let i = 0; i < length; i++) {
        const validFaces = outerMoves.filter(f => f !== lastFace);
        const face = validFaces[Math.floor(Math.random() * validFaces.length)];
        const slice = slices[Math.floor(Math.random() * slices.length)];
        const modifier = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];

        scramble.push(face + slice + modifier);
        lastFace = face;
    }

    return scramble.join(' ');
}

function generateMinxScramble(length = 70) {
    const moves = ['R', 'L', 'U', 'D', 'F'];
    const scramble = [];
    let lastMove = '';

    for (let i = 0; i < length; i++) {
        const validMoves = moves.filter(m => m !== lastMove);
        const move = validMoves[Math.floor(Math.random() * validMoves.length)];
        const modifier = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];
        const prime = Math.random() > 0.5 ? '+' : '-';

        scramble.push(move + prime + modifier);
        lastMove = move;
    }

    return scramble.join(' ');
}

export async function POST(request) {
    try {
        const { event } = await request.json();

        if (!event) {
            return NextResponse.json({ error: 'Event is required' }, { status: 400 });
        }

        const length = SCRAMBLE_LENGTHS[event] || 20;
        let scramble = '';

        switch (event) {
            case '333':
                scramble = generate333Scramble(length);
                break;
            case '222':
                scramble = generate333Scramble(length);
                break;
            case '444':
            case '555':
            case '666':
            case '777':
                scramble = generateBigCubeScramble(length);
                break;
            case 'pyram':
                scramble = generatePyraminxScramble(length);
                break;
            case 'skewb':
                scramble = generateSkewbScramble(length);
                break;
            case 'clock':
                scramble = generateClockScramble(length);
                break;
            case 'sq1':
                scramble = generateSq1Scramble(length);
                break;
            case 'minx':
                scramble = generateMinxScramble(length);
                break;
            default:
                scramble = generate333Scramble(length);
        }

        return NextResponse.json({ scramble });
    } catch (error) {
        console.error('Scramble generation error:', error);
        return NextResponse.json({ error: 'Failed to generate scramble' }, { status: 500 });
    }
}

export async function GET(request) {
    return NextResponse.json({
        message: 'Use POST to generate scrambles',
        events: Object.keys(SCRAMBLE_LENGTHS)
    });
}