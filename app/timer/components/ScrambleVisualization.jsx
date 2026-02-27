"use client";

import { useEffect, useRef, useState } from 'react';

export default function ScrambleVisualization({ scramble, eventId = '333', height = '200px' }) {
  const containerRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  const puzzleMap = {
    '333': '3x3x3',
    '222': '2x2x2',
    '444': '4x4x4',
    '555': '5x5x5',
    '666': '6x6x6',
    '777': '7x7x7',
    'pyram': 'pyraminx',
    'skewb': 'skewb',
    'sq1': 'square1',
    'clock': 'clock',
    'minx': 'megaminx',
  };

  useEffect(() => {
    if (!scramble || !containerRef.current) return;
    if (typeof window === 'undefined') return;

    let mounted = true;

    const init = async () => {
      try {
        const { TwistyPlayer } = await import('cubing/twisty');
        if (!mounted || !containerRef.current) return;

        const player = new TwistyPlayer({
          puzzle: puzzleMap[eventId] || '3x3x3',
          alg: scramble,
          visualization: '2D',
          background: 'checkered',
          hint: 'none',
          controlPanel: 'none',
        });

        const heightNum = parseInt(height) || 200;
        player.style.width = '100%';
        player.style.height = `${heightNum}px`;

        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(player);
        setLoaded(true);
      } catch (err) {
        console.error('Visualization error:', err);
        setError(err.message);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [scramble, eventId, height]);

  if (error) {
    return (
      <div 
        className="bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-500 text-xs"
        style={{ height }}
      >
        Visualization unavailable
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full bg-zinc-900 rounded-lg overflow-hidden"
      style={{ height }}
    >
      {!loaded && (
        <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">
          Loading...
        </div>
      )}
    </div>
  );
}
