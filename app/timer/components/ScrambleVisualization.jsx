'use client';

import { useRef } from 'react';
import { useTwistyPlayer } from '@/hooks/useCubingScramble';

export default function ScrambleVisualization({ scramble, eventId, height = '200px' }) {
    const containerRef = useRef(null);
    const { loading, error } = useTwistyPlayer(scramble, eventId, containerRef);

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
