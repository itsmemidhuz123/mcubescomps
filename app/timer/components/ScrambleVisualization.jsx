'use client';

import { useState, useEffect, useRef } from 'react';

const TWISTY_URL = 'https://cdn.cubing.net/v0/js/cubing/twisty';

const EVENT_MAP = {
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
  'minx': 'megaminx'
};

let twistyLoaded = false;
let twistyLoadPromise = null;

function loadTwisty() {
  if (twistyLoaded) return Promise.resolve();
  if (twistyLoadPromise) return twistyLoadPromise;

  twistyLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TWISTY_URL;
    script.type = 'module';
    script.onload = () => {
      twistyLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load twisty-player'));
    document.head.appendChild(script);
  });

  return twistyLoadPromise;
}

export default function ScrambleVisualization({ scramble, eventId, height = '200px' }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scramble || !containerRef.current) return;

    let mounted = true;

    const initTwisty = async () => {
      try {
        setLoading(true);
        await loadTwisty();
        
        if (!mounted) return;
        
        const container = containerRef.current;
        container.innerHTML = '';

        const player = document.createElement('twisty-player');
        player.setAttribute('alg', scramble);
        player.setAttribute('puzzle', EVENT_MAP[eventId] || '3x3x3');
        player.setAttribute('background', 'none');
        player.setAttribute('show-controls', 'false');
        player.setAttribute('show-toolbar', 'false');
        player.setAttribute('show-options', 'false');
        player.setAttribute('hint', 'none');
        player.setAttribute('camera-control', 'none');
        player.setAttribute('keyboard-shortcuts', 'none');
        player.setAttribute('animation', 'duration:0');
        player.style.width = '100%';
        player.style.height = '100%';
        player.style.border = 'none';
        
        container.appendChild(player);
        setError(null);
      } catch (err) {
        if (mounted) {
          console.error('Twisty player error:', err);
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initTwisty();

    return () => {
      mounted = false;
    };
  }, [scramble, eventId]);

  if (error) {
    return (
      <div className="w-full bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: height }}>
        <span className="text-red-400 text-sm">Error: {error}</span>
      </div>
    );
  }

  if (!scramble) {
    return (
      <div className="w-full bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: height }}>
        <span className="text-zinc-500 text-sm">Loading scramble...</span>
      </div>
    );
  }

  return (
    <div className="w-full bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: height }}>
      {loading ? (
        <span className="text-zinc-500 text-sm">Loading 3D...</span>
      ) : (
        <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: height }} />
      )}
    </div>
  );
}
