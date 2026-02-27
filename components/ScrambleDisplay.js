"use client";

import { useEffect, useRef, useState } from 'react';

export default function ScrambleDisplayComponent({
  eventId,
  scramble,
  visualization = "2D",
  width = 200,
  height = 200,
  checkered = true,
  className = ''
}) {
  const containerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const eventMap = {
    '333': '3x3x3', '444': '4x4x4', '555': '5x5x5', '666': '6x6x6', '777': '7x7x7',
    '222': '2x2x2', '333bf': '3x3x3', '333oh': '3x3x3', '333fm': '3x3x3',
    'clock': 'clock', 'minx': 'megaminx', 'pyram': 'pyraminx', 'skewb': 'skewb',
    'sq1': 'square1', '444bf': '4x4x4', '555bf': '5x5x5', '333mbf': '3x3x3',
  };

  useEffect(() => {
    if (!containerRef.current || !scramble) {
      setIsLoading(false);
      return;
    }
    if (typeof window === 'undefined') return;

    let mounted = true;

    const init = async () => {
      try {
        const { TwistyPlayer } = await import('cubing/twisty');
        if (!mounted || !containerRef.current) return;

        const player = new TwistyPlayer({
          puzzle: eventMap[eventId] || '3x3x3',
          alg: scramble,
          visualization: visualization === '3D' ? '3D' : '2D',
          background: checkered ? 'checkered' : 'none',
          hint: 'none',
          controlPanel: 'none',
        });
        player.style.width = `${width}px`;
        player.style.height = `${height}px`;
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(player);
        setIsLoading(false);
      } catch (err) {
        console.error('ScrambleDisplay error:', err);
        if (mounted) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [eventId, scramble, visualization, width, height, checkered]);

  if (!scramble) {
    return (
      <div
        className={`bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-500 text-sm ${className}`}
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        No scramble
      </div>
    );
  }

  return (
    <div
      className={`relative ${className}`}
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {isLoading && (
        <div
          className="absolute inset-0 bg-zinc-900 rounded-lg flex items-center justify-center z-10"
          style={{ width: `${width}px`, height: `${height}px` }}
        >
          <span className="text-xs text-zinc-500">Loading...</span>
        </div>
      )}
      {hasError && (
        <div
          className="bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-500 text-xs p-2 text-center"
          style={{ width: `${width}px`, height: `${height}px` }}
        >
          Preview unavailable
        </div>
      )}
      <div
        ref={containerRef}
        style={{ width: `${width}px`, height: `${height}px`, opacity: isLoading ? 0 : 1 }}
      />
    </div>
  );
}
