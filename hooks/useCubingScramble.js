"use client";

import { useEffect, useState, useRef, useCallback } from 'react';

const DEFAULT_EVENT = '333';

const MOVES = {
  '333': {
    faces: ['U', 'D', 'L', 'R', 'F', 'B'],
    modifiers: ['', "'", '2']
  },
  '222': {
    faces: ['U', 'D', 'L', 'R', 'F', 'B'],
    modifiers: ['', "'", '2']
  },
  '444': {
    faces: ['U', 'D', 'L', 'R', 'F', 'B', 'Uw', 'Dw', 'Lw', 'Rw', 'Fw', 'Bw'],
    modifiers: ['', "'", '2']
  },
  '555': {
    faces: ['U', 'D', 'L', 'R', 'F', 'B', 'Uw', 'Dw', 'Lw', 'Rw', 'Fw', 'Bw'],
    modifiers: ['', "'", '2']
  },
  'pyram': {
    faces: ['U', 'L', 'R', 'B'],
    modifiers: ['', "'", '2']
  },
  'skewb': {
    faces: ['U', 'L', 'R', 'B'],
    modifiers: ['', "'", '2']
  },
  'sq1': {
    faces: ['U', 'D'],
    modifiers: ['', "'"]
  },
  'clock': {
    faces: ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'],
    modifiers: ['+', '-']
  },
  'minx': {
    faces: ['U', 'L', 'R', 'F', 'B', 'DL', 'DR'],
    modifiers: ['', "'", '2']
  }
};

function generateRandomScramble(eventId, length = 20) {
  const eventConfig = MOVES[eventId] || MOVES['333'];
  const { faces, modifiers } = eventConfig;
  
  const scramble = [];
  let lastFace = '';
  
  for (let i = 0; i < length; i++) {
    let face;
    do {
      face = faces[Math.floor(Math.random() * faces.length)];
    } while (face === lastFace || (face.length > 1 && lastFace === face[0]));
    
    const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
    scramble.push(face + modifier);
    lastFace = face;
  }
  
  return scramble.join(' ');
}

export function useCubingScramble(eventId = DEFAULT_EVENT) {
  const [scramble, setScramble] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const generateScramble = useCallback(async (targetEventId = eventId) => {
    setLoading(true);
    setError(null);

    try {
      const mod = await import('cubing/scramble');
      
      if (mod?.randomScrambleForEvent) {
        const alg = await mod.randomScrambleForEvent(targetEventId, { worker: false });
        setScramble(alg.toString());
        retryCountRef.current = 0;
      }
    } catch (e) {
      console.warn('[Cubing] Worker failed, using fallback scramble:', e.message);
      
      retryCountRef.current++;
      
      if (retryCountRef.current < maxRetries) {
        setTimeout(() => generateScramble(targetEventId), 100);
      } else {
        const fallbackScramble = generateRandomScramble(targetEventId);
        setScramble(fallbackScramble);
        retryCountRef.current = 0;
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) {
      generateScramble(eventId);
    }
  }, [eventId, generateScramble]);

  return { scramble, isLoading: loading, error, generateScramble };
}
