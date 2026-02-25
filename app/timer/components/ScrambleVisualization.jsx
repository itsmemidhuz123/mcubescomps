'use client';

import { useMemo, useEffect, useRef, useState } from 'react';

const PUZZLE_MAP = {
    '333': '3x3x3',
    '222': '2x2x2',
    '444': '4x4x4',
    '555': '5x5x5',
    '666': '6x6x6',
    '777': '7x7x7',
    'pyram': 'Pyraminx',
    'skewb': 'Skewb',
    'sq1': 'Square-1',
    'clock': 'Clock',
    'minx': 'Megaminx'
};

const FACE_COLORS = {
    '333': {
        R: '#B90000',
        L: '#FF5900',
        U: '#FFFFFF',
        D: '#009E60',
        F: '#0045AD',
        B: '#C41E3A'
    }
};

export default function ScrambleVisualization({ scramble, eventId, height = '150px' }) {
    const puzzleName = useMemo(() => PUZZLE_MAP[eventId] || '3x3x3', [eventId]);
    const canvasRef = useRef(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!scramble || !canvasRef.current || !mounted) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const size = Math.min(300, parseInt(height) || 150);

        canvas.width = size * 3;
        canvas.height = size * 3;

        const cellSize = size / 3;
        const colors = FACE_COLORS[eventId] || FACE_COLORS['333'];

        // Draw unfolded cube
        const faceWidth = cellSize * 3;
        const faceHeight = cellSize * 3;
        const gap = 2;

        const drawFace = (face, x, y, rotate = 0) => {
            ctx.save();
            ctx.translate(x + faceWidth / 2, y + faceHeight / 2);

            if (rotate) {
                ctx.rotate(rotate);
            }

            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 3; col++) {
                    const color = colors[face] || '#ffffff';
                    ctx.fillStyle = color;
                    ctx.fillRect(
                        col * cellSize,
                        row * cellSize,
                        cellSize - gap,
                        cellSize - gap
                    );

                    // Draw border
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(
                        col * cellSize,
                        row * cellSize,
                        cellSize - gap,
                        cellSize - gap
                    );
                }
            }

            ctx.restore();
        };

        // Unfolded 3x3x3 cube layout
        const padding = 5;
        const startX = (canvas.width - (faceWidth * 4 + gap * 3)) / 2;
        const startY = (canvas.height - faceHeight) / 2;

        // Front face (white)
        drawFace('U', startX, startY);

        // Back face (yellow) - rotated
        drawFace('D', startX + faceWidth + gap * 2, startY, Math.PI);

        // Right face (red)
        drawFace('R', startX, startY + faceHeight + gap);

        // Left face (orange)
        drawFace('L', startX + faceWidth + gap * 2, startY + faceHeight + gap, Math.PI);

        // Up face (green)
        drawFace('F', startX + faceWidth + gap, startY);

        // Down face (blue) - rotated
        drawFace('B', startX + faceWidth + gap * 2, startY + faceHeight + gap, Math.PI);
    }, [scramble, eventId, height, mounted]);

    return (
        <div className="w-full">
            <div className="w-full flex items-center justify-center bg-zinc-900 rounded-lg overflow-hidden" style={{ minHeight: height }}>
                {mounted && scramble ? (
                    <canvas
                        ref={canvasRef}
                        className="max-w-full max-h-full"
                        style={{ maxWidth: '100%', maxHeight: '100%' }}
                    />
                ) : (
                    <span className="text-zinc-500">Loading...</span>
                )}
            </div>
        </div>
    );
}
