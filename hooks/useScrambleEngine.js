import { useState, useEffect, useCallback, useRef } from 'react';

const SCRAMBLE_TYPES = {
    '333': { name: '3x3x3', length: 20 },
    '222': { name: '2x2x2', length: 11 },
    '444': { name: '4x4x4', length: 40 },
    '555': { name: '5x5x5', length: 60 },
    '666': { name: '6x6x6', length: 80 },
    '777': { name: '7x7x7', length: 100 },
    'pyram': { name: 'Pyraminx', length: 11 },
    'skewb': { name: 'Skewb', length: 11 },
    'sq1': { name: 'Square-1', length: 40 },
    'clock': { name: 'Clock', length: 15 },
    'minx': { name: 'Megaminx', length: 70 }
};

const MOVES_333 = ['R', 'L', 'U', 'D', 'F', 'B'];
const MODIFIERS = ['', "'", '2'];

function generateScramble(eventId) {
    const config = SCRAMBLE_TYPES[eventId] || SCRAMBLE_TYPES['333'];
    const length = config.length;

    switch (eventId) {
        case '333':
        case '222':
            return generate333Scramble(length);
        case '444':
        case '555':
        case '666':
        case '777':
            return generateBigCubeScramble(length, eventId);
        case 'pyram':
            return generatePyraminxScramble(length);
        case 'skewb':
            return generateSkewbScramble(length);
        case 'clock':
            return generateClockScramble(length);
        case 'sq1':
            return generateSq1Scramble(length);
        case 'minx':
            return generateMinxScramble(length);
        default:
            return generate333Scramble(length);
    }
}

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

function generateBigCubeScramble(length, eventId) {
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

function generatePyraminxScramble(length = 11) {
    const moves = ['R', 'L', 'U', 'B'];
    const scramble = [];
    let lastMove = '';

    for (let i = 0; i < length; i++) {
        const validMoves = moves.filter(m => m !== lastMove);
        const move = validMoves[Math.floor(Math.random() * validMoves.length)];
        const modifier = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];
        scramble.push(move + modifier);
        lastMove = move;
    }

    return scramble.join(' ');
}

function generateSkewbScramble(length = 11) {
    const moves = ['R', 'L', 'U', 'B'];
    const scramble = [];
    let lastMove = '';

    for (let i = 0; i < length; i++) {
        const validMoves = moves.filter(m => m !== lastMove);
        const move = validMoves[Math.floor(Math.random() * validMoves.length)];
        const modifier = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];
        scramble.push(move + modifier);
        lastMove = move;
    }

    return scramble.join(' ');
}

function generateClockScramble(length = 15) {
    const moves = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'];
    const scramble = [];

    for (let i = 0; i < length; i++) {
        const move = moves[Math.floor(Math.random() * moves.length)];
        const modifier = Math.floor(Math.random() * 12) - 6;
        const modStr = modifier > 0 ? '+' + modifier : '' + modifier;
        scramble.push(move === 'ALL' ? 'ALL' + modStr : move + modStr);
    }

    return scramble.join(' ');
}

function generateSq1Scramble(length = 40) {
    const scramble = [];
    let parenDepth = 0;

    for (let i = 0; i < length; i++) {
        const move = Math.floor(Math.random() * 11) - 5;
        const slash = Math.random() > 0.7 ? '/' : '';

        if (slash === '/' && parenDepth > 0) {
            scramble.push(')');
            parenDepth--;
        }

        scramble.push(move + slash);

        if (slash === '/' && Math.random() > 0.5 && parenDepth < 2) {
            scramble.push('(');
            parenDepth++;
        }
    }

    while (parenDepth > 0) {
        scramble.push(')');
        parenDepth--;
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

export const useScrambleEngine = (eventId) => {
    const [scramble, setScramble] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const generateScramble = useCallback(() => {
        setIsLoading(true);
        setError(null);
        try {
            const newScramble = generateScramble(eventId);
            setScramble(newScramble);
        } catch (err) {
            setError(err.message);
            setScramble('R U R\' U\'');
        }
        setIsLoading(false);
    }, [eventId]);

    useEffect(() => {
        generateScramble();
    }, [eventId]);

    return {
        scramble,
        isLoading,
        error,
        generateScramble
    };
};

export { SCRAMBLE_TYPES, generateScramble };