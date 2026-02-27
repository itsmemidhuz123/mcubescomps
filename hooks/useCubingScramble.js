"use client";

import { useEffect, useState, useRef, useCallback } from 'react';

const DEFAULT_EVENT = '333';

export function useCubingScramble(eventId = DEFAULT_EVENT) {
  const [scramble, setScramble] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cubingRef = useRef(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const generateScramble = useCallback(async (targetEventId = eventId) => {
    setLoading(true);
    setError(null);

    try {
      if (!cubingRef.current) {
        const mod = await import('cubing/scramble');
        cubingRef.current = mod;
      }

      const mod = cubingRef.current;
      if (mod?.randomScrambleForEvent) {
        const alg = await mod.randomScrambleForEvent(targetEventId, { worker: false });
        setScramble(alg.toString());
        retryCountRef.current = 0;
      }
    } catch (e) {
      console.error('[Cubing Scramble] Error:', e);
      retryCountRef.current++;

      if (retryCountRef.current < maxRetries) {
        setTimeout(() => generateScramble(targetEventId), 100);
      } else {
        setError('Failed to generate scramble');
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
