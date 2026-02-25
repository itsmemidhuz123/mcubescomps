'use client';

import { useEffect, useState } from 'react';

export default function ScrambleVisualization({ scramble, eventId, height = '150px' }) {
    const [scrambleText, setScrambleText] = useState('');
    const containerId = `scramble-${Math.random().toString(36).substr(2, 9)}`;

    useEffect(() => {
        if (!scramble) return;
        setScrambleText(scramble);
    }, [scramble]);

    useEffect(() => {
        if (!scrambleText) return;

        const loadScript = () => {
            if (document.getElementById('twisty-player-script')) {
                updatePlayer();
                return;
            }

            const script = document.createElement('script');
            script.id = 'twisty-player-script';
            script.src = 'https://cdn.cubing.net/v0/js/cubing/twisty';
            script.type = 'module';
            script.onload = () => updatePlayer();
            document.head.appendChild(script);
        };

        const updatePlayer = () => {
            const container = document.getElementById(containerId);
            if (!container || !window.customElements.get('twisty-player')) return;

            container.innerHTML = '';

            const player = document.createElement('twisty-player');
            player.setAttribute('alg', scrambleText);
            player.setAttribute('puzzle', '3x3x3');
            player.setAttribute('background', 'none');
            player.setAttribute('show-controls', 'false');
            player.setAttribute('animation', 'duration:0');
            player.setAttribute('hint', 'none');
            player.style.width = '100%';
            player.style.height = '100%';

            container.appendChild(player);
        };

        loadScript();
    }, [scrambleText, containerId]);

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
        <div className="w-full">
            <div
                id={containerId}
                className="w-full flex items-center justify-center bg-zinc-900 rounded-lg overflow-hidden"
                style={{ minHeight: height }}
            >
                <span className="text-zinc-500">Loading 3D...</span>
            </div>
        </div>
    );
}
