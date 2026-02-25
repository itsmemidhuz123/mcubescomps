'use client';

import { Button } from '@/components/ui/button';
import { Copy, RefreshCw, Loader2 } from 'lucide-react';
import { useState } from 'react';
import ScrambleVisualization from './ScrambleVisualization';

export default function ScrambleCard({
    scramble,
    onRefresh,
    eventId,
    isLoading = false
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (scramble) {
            try {
                await navigator.clipboard.writeText(scramble);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        }
    };

    return (
        <div className="bg-[#161a23] border border-[#2a2f3a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Scramble
                </span>
                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopy}
                        disabled={!scramble}
                        className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                    >
                        <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <RefreshCw className="w-4 h-4" />
                        )}
                    </Button>
                </div>
            </div>

            {scramble && (
                <div className="mb-3" key={eventId}>
                    <ScrambleVisualization
                        scramble={scramble}
                        eventId={eventId}
                        height="200px"
                    />
                </div>
            )}

            <div className="text-center min-h-[40px] flex items-center justify-center">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-zinc-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                    </div>
                ) : (
                    <p className="font-mono text-sm text-zinc-400 tracking-wide leading-relaxed break-all px-2">
                        {scramble || 'Press refresh to generate scramble'}
                    </p>
                )}
            </div>

            {copied && (
                <p className="text-center text-xs text-green-500 mt-2">
                    Copied!
                </p>
            )}
        </div>
    );
}
