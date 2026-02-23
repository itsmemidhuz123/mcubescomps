'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

const EVENT_TO_PUZZLE = {
    '333': '3x3x3',
    '222': '2x2x2',
    '444': '4x4x4',
    '555': '5x5x5',
    '666': '6x6x6',
    '777': '7x7x7',
    'pyram': 'pyraminx',
    'skewb': 'skewb',
    'sq1': 'sq1',
    'clock': 'clock',
    'minx': 'megaminx'
};

export default function ScrambleImageModal({ isOpen, onClose, scramble, eventId }) {
    const containerRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const cleanupRef = useRef(null);

    const puzzle = useMemo(() => EVENT_TO_PUZZLE[eventId] || '3x3x3', [eventId]);

    useEffect(() => {
        if (!isOpen || !scramble) return;

        let mounted = true;
        const container = containerRef.current;
        if (!container) return;

        // Cleanup previous
        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }

        const loadTwistyPlayer = async () => {
            setIsLoading(true);
            setLoadError(null);

            try {
                const existingScript = document.querySelector('script[src*="cubing/v0/js/cubing/twisty"]');
                if (!existingScript) {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdn.cubing.net/v0/js/cubing/twisty';
                        script.type = 'module';
                        script.onload = resolve;
                        script.onerror = () => reject(new Error('Failed to load twisty player'));
                        document.head.appendChild(script);
                    });
                }

                if (!mounted) return;

                await new Promise(r => setTimeout(r, 100));

                if (!mounted || !containerRef.current) return;

                // Safe cleanup
                try {
                    containerRef.current.innerHTML = '';
                } catch (e) {
                    // Ignore
                }

                const player = document.createElement('twisty-player');
                player.setAttribute('puzzle', puzzle);
                player.setAttribute('alg', scramble);
                player.setAttribute('hint', 'none');
                player.setAttribute('control-panel', 'none');
                player.setAttribute('background', 'none');
                player.style.width = '100%';
                player.style.height = '350px';

                containerRef.current.appendChild(player);
            } catch (err) {
                console.error('Error loading twisty player:', err);
                if (mounted) setLoadError(err.message);
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        loadTwistyPlayer();

        // Cleanup function
        cleanupRef.current = () => {
            mounted = false;
        };

        return () => {
            mounted = false;
            try {
                if (containerRef.current) {
                    containerRef.current.innerHTML = '';
                }
            } catch (e) {
                // Ignore
            }
        };
    }, [isOpen, scramble, puzzle]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#0f1117] border-[#2a2f3a] max-w-lg w-[90vw]">
                <DialogHeader>
                    <DialogTitle className="text-white">Scramble Visualization</DialogTitle>
                    <DialogDescription className="sr-only">
                        3D visualization of the current scramble
                    </DialogDescription>
                </DialogHeader>

                <div
                    ref={containerRef}
                    className="w-full min-h-[350px] flex items-center justify-center bg-[#161a23] rounded-lg overflow-hidden"
                >
                    {isLoading && (
                        <div className="text-zinc-500">Loading 3D view...</div>
                    )}
                    {loadError && (
                        <div className="text-red-400">Failed to load: {loadError}</div>
                    )}
                </div>

                <div className="text-center">
                    <p className="font-mono text-sm text-zinc-400 break-all">{scramble}</p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
