'use client';

import { useState, useEffect, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PUZZLE_MAP = {
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

export default function ScrambleVisualization({ scramble, eventId, height = '150px' }) {
    const [twistyLoaded, setTwistyLoaded] = useState(false);
    const playerRef = useRef(null);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://cdn.cubing.net/v0/js/cubing/twisty';
        script.type = 'module';
        script.onload = () => setTwistyLoaded(true);
        document.head.appendChild(script);
    }, []);

    useEffect(() => {
        if (!twistyLoaded || !scramble) return;

        if (playerRef.current) {
            playerRef.current.alg = scramble;
            playerRef.current.setAttribute('puzzle', PUZZLE_MAP[eventId] || '3x3x3');
        }
    }, [scramble, eventId, twistyLoaded]);

    const open3D = () => {
        const puzzle = PUZZLE_MAP[eventId] || '3x3x3';
        window.open(`https://alpha.twizzle.net/edit/?alg=${encodeURIComponent(scramble)}&puzzle=${puzzle}`, '_blank');
    };

    if (!scramble) {
        return (
            <div className="w-full">
                <div
                    className="w-full flex items-center justify-center bg-zinc-900 rounded-lg overflow-hidden"
                    style={{ minHeight: height }}
                >
                    <span className="text-zinc-500">Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col gap-2">
            <div className="w-full bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center" style={{ height }}>
                {twistyLoaded ? (
                    <twisty-player
                        ref={playerRef}
                        alg={scramble}
                        puzzle={PUZZLE_MAP[eventId] || '3x3x3'}
                        background="none"
                        show-controls="false"
                        animation="duration:0"
                        style={{ width: '100%', height: '100%' }}
                    />
                ) : (
                    <span className="text-zinc-500">Loading 3D...</span>
                )}
            </div>
            <Button
                variant="outline"
                size="sm"
                onClick={open3D}
                className="w-full text-xs"
            >
                <ExternalLink className="w-3 h-3 mr-2" />
                Open 3D View
            </Button>
        </div>
    );
}