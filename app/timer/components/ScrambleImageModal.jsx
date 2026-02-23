'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const SCRAMBLE_TO_CUBING = {
    '333': 'cube',
    '222': '2x2x2', a
  '444': '4x4x4',
    '555': '5x5x5',
    '666': '6x6x6',
    '777': '7x7x7',
    'pyram': 'pyram',
    'skewb': 'skewb',
    'sq1': 'sq1',
    'clock': 'clock',
    'minx': 'megaminx'
};

export default function ScrambleImageModal({ isOpen, onClose, scramble, eventId }) {
    const containerRef = useRef(null);
    const playerRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !scramble) return;

        const loadTwistyPlayer = async () => {
            setIsLoading(true);

            if (!window.twistyPlayer) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/cubing@0.0.38/twistyplayer/dist/twistyplayer.js';
                script.async = true;
                document.head.appendChild(script);

                await new Promise((resolve) => {
                    script.onload = resolve;
                });
            }

            if (playerRef.current) {
                playerRef.current.remove();
            }

            const player = document.createElement('twisty-player');
            player.setAttribute('animation', 'none');
            player.setAttribute('hint', 'none');
            player.setAttribute('background', 'none');
            player.setAttribute('camera-orbit', '45deg 55deg 2.5');
            player.setAttribute('experimental-time-estimator', 'none');

            const cubingEvent = SCRAMBLE_TO_CUBING[eventId] || 'cube';
            player.setAttribute('puzzle', cubingEvent);
            player.setAttribute('scramble', scramble);

            if (containerRef.current) {
                containerRef.current.innerHTML = '';
                containerRef.current.appendChild(player);
                playerRef.current = player;
            }

            setIsLoading(false);
        };

        loadTwistyPlayer();

        return () => {
            if (playerRef.current) {
                playerRef.current.remove();
                playerRef.current = null;
            }
        };
    }, [isOpen, scramble, eventId]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#0f1117] border-[#2a2f3a] max-w-lg w-[90vw]">
                <DialogHeader>
                    <DialogTitle className="text-white">Scramble Visualization</DialogTitle>
                </DialogHeader>

                <div
                    ref={containerRef}
                    className="w-full aspect-square flex items-center justify-center bg-[#161a23] rounded-lg overflow-hidden"
                >
                    {isLoading && (
                        <div className="text-zinc-500">Loading 3D view...</div>
                    )}
                </div>

                <div className="text-center">
                    <p className="font-mono text-sm text-zinc-400">{scramble}</p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
