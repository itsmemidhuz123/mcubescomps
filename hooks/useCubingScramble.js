"use client";

import { useEffect, useState, useRef, useCallback } from 'react';

const DEFAULT_EVENT = '333';

const SCRAMBLE_LENGTHS = {
  '222': 11,
  '333': 25,
  '444': 40,
  '555': 60,
  '666': 80,
  '777': 100,
  'pyram': 11,
  'skewb': 11,
  'clock': 17,
  'sq1': 40,
  'minx': 70,
};

const PUZZLE_MOVES = {
  '333': ['R', 'L', 'U', 'D', 'F', 'B'],
  '222': ['R', 'L', 'U', 'D', 'F', 'B'],
  '444': ['R', 'L', 'U', 'D', 'F', 'B', 'Rw', 'Lw', 'Uw', 'Dw', 'Fw', 'Bw'],
  '555': ['R', 'L', 'U', 'D', 'F', 'B', 'Rw', 'Lw', 'Uw', 'Dw', 'Fw', 'Bw'],
  '666': ['R', 'L', 'U', 'D', 'F', 'B', 'Rw', 'Lw', 'Uw', 'Dw', 'Fw', 'Bw', '3Rw', '3Lw'],
  '777': ['R', 'L', 'U', 'D', 'F', 'B', 'Rw', 'Lw', 'Uw', 'Dw', 'Fw', 'Bw', '3Rw', '3Lw'],
  'pyram': ['R', 'L', 'U', 'B'],
  'skewb': ['R', 'L', 'U', 'B'],
  'clock': ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'],
  'sq1': ['/', '(', ')', 'U', 'D', 'R', 'L', 'B', 'F'],
  'minx': ['R', 'L', 'U', 'D', 'F', 'B', 'LD', 'RD', 'DF', 'DR', 'UF', 'UB'],
};

const MODIFIERS = ['', "'", '2'];

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function generateScramble(eventId) {
  const moves = PUZZLE_MOVES[eventId] || PUZZLE_MOVES['333'];
  const length = SCRAMBLE_LENGTHS[eventId] || 25;
  const modifierCount = eventId === 'sq1' ? 1 : MODIFIERS.length;
  
  const scramble = [];
  let lastMove = '';
  let lastGroup = '';
  
  for (let i = 0; i < length; i++) {
    let move;
    let attempts = 0;
    
    do {
      move = moves[getRandomInt(moves.length)];
      attempts++;
    } while (
      attempts < 20 && (
        move === lastMove ||
        (move.length > 1 && move[0] === lastGroup) ||
        (move.length > 1 && move.includes('w') && lastMove.includes('w'))
      )
    );
    
    let modifier = '';
    if (eventId === 'clock') {
      modifier = getRandomInt(2) === 0 ? '+' : '-';
    } else if (eventId !== 'sq1') {
      modifier = MODIFIERS[getRandomInt(modifierCount)];
    }
    
    scramble.push(move + modifier);
    lastMove = move;
    lastGroup = move.charAt(0);
  }
  
  return scramble.join(' ');
}

export function useCubingScramble(eventId = DEFAULT_EVENT) {
  const [scramble, setScramble] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const generateScrambleFn = useCallback((targetEventId = eventId) => {
    setLoading(true);
    setError(null);
    
    try {
      const newScramble = generateScramble(targetEventId);
      setScramble(newScramble);
    } catch (e) {
      console.error('Scramble error:', e);
      setError('Failed to generate scramble');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) {
      generateScrambleFn(eventId);
    }
  }, [eventId, generateScrambleFn]);

  return { scramble, isLoading: loading, error, generateScramble: generateScrambleFn };
}
