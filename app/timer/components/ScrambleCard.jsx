'use client';

import { Button } from '@/components/ui/button';
import { Copy, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { useState } from 'react';

export default function ScrambleCard({
    scramble,
    onRefresh,
    onShowImage,
    isLoading = false
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (scramble) {
            await navigator.clipboard.writeText(scramble);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="bg-[#161a23] border border-[#2a2f3a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Scramble
                </span>
                <div className="flex gap-1">
                    {onShowImage && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onShowImage}
                            className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                        >
                            <ImageIcon className="w-4 h-4" />
                        </Button>
                    )}
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
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            <div className="text-center">
                <p className="font-mono text-lg text-white tracking-wide leading-relaxed">
                    {scramble || 'Loading scramble...'}
                </p>
            </div>

            {copied && (
                <p className="text-center text-xs text-green-500 mt-2">
                    Copied!
                </p>
            )}
        </div>
    );
}
