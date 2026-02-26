'use client';

import ScrambleDisplay from '@/components/ScrambleDisplay';

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
    'minx': 'megaminx',
    '333bf': '3x3x3',
    '333oh': '3x3x3',
    '333fm': '3x3x3',
    '444bf': '4x4x4',
    '555bf': '5x5x5',
    '333mbf': '3x3x3'
};

export default function ScrambleVisualization({ scramble, eventId, height = '200px' }) {
    const puzzle = EVENT_MAP[eventId] || '3x3x3';
    const heightNum = parseInt(height) || 200;

    if (!scramble) {
        return (
            <div
                className="w-full bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center"
                style={{ minHeight: height }}
            >
                <span className="text-zinc-500 text-sm">No scramble</span>
            </div>
        );
    }

    return (
        <div className="w-full bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: height }}>
            <ScrambleDisplay
                eventId={eventId}
                scramble={scramble}
                visualization="3D"
                width={heightNum}
                height={heightNum}
                checkered={true}
            />
        </div>
    );
}