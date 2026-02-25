'use client';

import { useState, useEffect } from 'react';

export default function ScrambleVisualization({ scramble, eventId, height = '150px' }) {
    const [scrambleUrl, setScrambleUrl] = useState('');

    useEffect(() => {
        if (scramble) {
            setScrambleUrl(`https://alpha.twizzle.net/view/?alg=${encodeURIComponent(scramble)}&puzzle=3x3x3`);
        }
    }, [scramble]);

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
        <iframe
            src={scrambleUrl}
            title="Scramble"
            style={{
                width: '100%',
                height: height,
                border: 'none',
                background: '#161a23',
                borderRadius: '8px'
            }}
            sandbox="allow-scripts allow-same-origin"
        />
    );
}