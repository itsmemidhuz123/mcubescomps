'use client';

import { useState, useEffect, useRef } from 'react';

const SCRAMBLE_DISPLAY_URL = 'https://cdn.cubing.net/v0/js/scramble-display';

const EVENT_MAP = {
  '333': '333',
  '222': '222',
  '444': '444',
  '555': '555',
  '666': '666',
  '777': '777',
  'pyram': 'pyram',
  'skewb': 'skewb',
  'sq1': 'sq1',
  'clock': 'clock',
  'minx': 'minx'
};

let scrambleDisplayLoaded = false;

export default function ScrambleVisualization({ scramble, eventId, height = '200px' }) {
  const containerRef = useRef(null);
  const displayRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scramble || !containerRef.current) return;

    let mounted = true;

    const initScrambleDisplay = async () => {
      try {
        setLoading(true);
        
        if (!scrambleDisplayLoaded) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = SCRAMBLE_DISPLAY_URL;
            script.type = 'module';
            script.onload = () => {
              scrambleDisplayLoaded = true;
              resolve();
            };
            script.onerror = () => reject(new Error('Failed to load scramble-display'));
            document.head.appendChild(script);
          });
        }

        if (!mounted) return;

        containerRef.current.innerHTML = '';

        const display = document.createElement('scramble-display');
        display.setAttribute('scramble', scramble);
        display.setAttribute('event', EVENT_MAP[eventId] || '333');
        display.style.width = '100%';
        display.style.height = '100%';
        display.style.display = 'block';
        
        containerRef.current.appendChild(display);
        displayRef.current = display;
        setError(null);
      } catch (err) {
        if (mounted) {
          console.error('ScrambleDisplay error:', err);
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initScrambleDisplay();

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
        <span className="text-zinc-500 text-sm">No scramble</span>
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
