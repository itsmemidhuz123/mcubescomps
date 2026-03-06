import { useCallback, useRef, useEffect } from 'react';

const SOUNDS_BASE = '/sounds';

const soundFiles = {
  intro: `${SOUNDS_BASE}/intro.mp3`,
  'countdown-5': `${SOUNDS_BASE}/countdown-5.mp3`,
  'countdown-4': `${SOUNDS_BASE}/countdown-4.mp3`,
  'countdown-3': `${SOUNDS_BASE}/countdown-3.mp3`,
  'countdown-2': `${SOUNDS_BASE}/countdown-2.mp3`,
  'countdown-1': `${SOUNDS_BASE}/countdown-1.mp3`,
  'battle-start': `${SOUNDS_BASE}/battle-start.mp3`,
  victory: `${SOUNDS_BASE}/victory.mp3`,
  defeat: `${SOUNDS_BASE}/defeat.mp3`,
};

export function useBattleSounds() {
  const audioRefs = useRef({});

  useEffect(() => {
    Object.entries(soundFiles).forEach(([key, src]) => {
      if (!audioRefs.current[key]) {
        audioRefs.current[key] = new Audio(src);
        audioRefs.current[key].preload = 'auto';
      }
    });

    return () => {
      Object.values(audioRefs.current).forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
    };
  }, []);

  const playSound = useCallback((soundName) => {
    const audio = audioRefs.current[soundName];
    if (audio) {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.log('Audio play error:', err.message);
        });
      }
    } else {
      console.log('Sound not found:', soundName);
    }
  }, []);

  const playIntro = useCallback(() => {
    playSound('intro');
  }, [playSound]);

  const playCountdown = useCallback((num) => {
    if (num >= 1 && num <= 5) {
      playSound(`countdown-${num}`);
    }
  }, [playSound]);

  const playBattleStart = useCallback(() => {
    playSound('battle-start');
  }, [playSound]);

  const playVictory = useCallback(() => {
    playSound('victory');
  }, [playSound]);

  const playDefeat = useCallback(() => {
    playSound('defeat');
  }, [playSound]);

  return {
    playIntro,
    playCountdown,
    playBattleStart,
    playVictory,
    playDefeat,
  };
}

export function useBattleIntro() {
  const shouldShowIntro = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('battle_intro_dismissed') !== 'true';
  }, []);

  const dismissIntro = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('battle_intro_dismissed', 'true');
    }
  }, []);

  return {
    shouldShowIntro,
    dismissIntro,
  };
}
