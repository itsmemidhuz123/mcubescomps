"use client";

import { useEffect, useState, useRef } from 'react';

export function useCubingScramble(eventId) {
  const [scramble, setScramble] = useState('');
  const [loading, setLoading] = useState(true);
  const cubingRef = useRef(null);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    const loadCubing = async () => {
      try {
        const mod = await import('cubing');
        cubingRef.current = mod;
        if (mod?.randomScrambleForEvent) {
          const alg = await mod.randomScrambleForEvent(eventId, { worker: false });
          setScramble(alg.toString());
        }
      } catch (e) {
        console.error('[Cubing Scramble] load error', e);
      } finally {
        setLoading(false);
      }
    };

    loadCubing();
  }, [eventId]);

  const generateScramble = async () => {
    if (!eventId || !cubingRef.current?.randomScrambleForEvent) return;
    setLoading(true);
    try {
      const alg = await cubingRef.current.randomScrambleForEvent(eventId, { worker: false });
      setScramble(alg.toString());
    } catch (e) {
      console.error('[Cubing Scramble] generate error', e);
      setScramble('');
    } finally {
      setLoading(false);
    }
  };

  return { scramble, isLoading: loading, generateScramble };
}
