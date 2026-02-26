'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const EVENT_TO_PUZZLE = {
    '333': '3x3x3', '222': '2x2x2', '444': '4x4x4', '555': '5x5x5',
    '666': '6x6x6', '777': '7x7x7', 'pyram': 'pyraminx', 'skewb': 'skewb',
    'sq1': 'sq1', 'clock': 'clock', 'minx': 'megaminx'
};

const EVENT_TO_DISPLAY = {
    '333': '3x3x3', '222': '2x2x2', '444': '4x4x4', '555': '5x5x5',
    '666': '6x6x6', '777': '7x7x7', 'pyram': 'pyraminx', 'skewb': 'skewb',
    'sq1': 'square1', 'clock': 'clock', 'minx': 'megaminx'
};

const PROBLEMATIC_EVENTS = ['sq1', 'clock'];

function loadCubingScript() {
    return new Promise((resolve, reject) => {
        if (window.cubing) { resolve(window.cubing); return; }
        const scriptId = 'cubing-modal-script';
        const existing = document.getElementById(scriptId);
        if (existing) {
            existing.addEventListener('load', () => resolve(window.cubing));
            existing.addEventListener('error', () => reject(new Error('Failed to load')));
            return;
        }
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://cdn.cubing.net/v0/js/cubing/twisty';
        script.type = 'module';
        script.onload = () => setTimeout(() => resolve(window.cubing), 100);
        script.onerror = () => reject(new Error('Failed to load'));
        document.head.appendChild(script);
    });
}

function ScrambleModalInner({ scramble, eventId }) {
    const containerRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);

    const puzzle = useMemo(() => EVENT_TO_PUZZLE[eventId] || '3x3x3', [eventId]);
    const displayEvent = useMemo(() => EVENT_TO_DISPLAY[eventId] || '3x3x3', [eventId]);
    const use2D = PROBLEMATIC_EVENTS.includes(eventId);

    useEffect(() => {
        if (!scramble) return;
        if (typeof window === 'undefined') return;

        let cancelled = false;

        loadCubingScript()
            .then((cubing) => {
                if (cancelled || !containerRef.current) return;

                if (use2D) {
                    const ScrambleDisplay = cubing.ScrambleDisplay;
                    const display = new ScrambleDisplay({
                        event: displayEvent, visualization: '2D', checkered: true, alg: scramble
                    });
                    display.style.width = '100%';
                    display.style.height = '350px';
                    containerRef.current.innerHTML = '';
                    containerRef.current.appendChild(display);
                } else {
                    const TwistyPlayer = cubing.TwistyPlayer;
                    const player = new TwistyPlayer({
                        puzzle: puzzle, alg: scramble, hint: 'none', controlPanel: 'none', background: 'none'
                    });
                    player.style.width = '100%';
                    player.style.height = '350px';
                    containerRef.current.innerHTML = '';
                    containerRef.current.appendChild(player);
                }
            })
            .catch((err) => { if (!cancelled) setLoadError(err.message); })
            .finally(() => { if (!cancelled) setIsLoading(false); });

        return () => { cancelled = true; };
    }, [scramble, puzzle, displayEvent, use2D]);

    if (loadError) {
        return (
            <div className="w-full min-h-[350px] flex items-center justify-center bg-[#161a23] rounded-lg overflow-hidden">
                <div className="text-center px-4">
                    <p className="text-zinc-400 mb-2">Visualization unavailable</p>
                    <p className="font-mono text-sm text-zinc-500">{scramble}</p>
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="w-full min-h-[350px] flex items-center justify-center bg-[#161a23] rounded-lg overflow-hidden">
            {isLoading && <div className="text-zinc-500">Loading...</div>}
        </div>
    );
}

export default function ScrambleImageModal({ isOpen, onClose, scramble, eventId }) {
    const key = useMemo(() => `${scramble}_${eventId}`, [scramble, eventId]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#0f1117] border-[#2a2f3a] max-w-lg w-[90vw]">
                <DialogHeader>
                    <DialogTitle className="text-white">Scramble Visualization</DialogTitle>
                    <DialogDescription className="sr-only">Visualization of the current scramble</DialogDescription>
                </DialogHeader>
                {scramble && <ScrambleModalInner key={key} scramble={scramble} eventId={eventId} />}
                <div className="text-center">
                    <p className="font-mono text-sm text-zinc-400 break-all">{scramble}</p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
