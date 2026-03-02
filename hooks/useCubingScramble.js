"use client";

import { useEffect, useState, useCallback } from 'react';

const DEFAULT_EVENT = '333';

export function useCubingScramble(eventId = DEFAULT_EVENT) {
  const [scramble, setScramble] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const generateScramble = useCallback(async (targetEventId = eventId) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/scramble?event=${targetEventId}`);
      const data = await response.json();
      
      if (data.scramble) {
        setScramble(data.scramble);
      } else {
        throw new Error(data.error || 'Failed to get scramble');
      }
    } catch (e) {
      console.error('[Scramble] Error:', e);
      setError('Failed to generate scramble');
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
