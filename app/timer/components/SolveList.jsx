'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { formatTime, getFinalTime } from '@/lib/timerStats';
import { Trash2, Plus, X, ChevronUp, List } from 'lucide-react';

export default function SolveList({
    solves,
    stats,
    bestSingle,
    onDeleteSolve,
    onUpdatePenalty,
    onViewAll
}) {
    const listRef = useRef(null);
    const bestSingleTime = bestSingle;

    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = 0;
        }
    }, [solves.length]);

    const getTimeClass = (solve) => {
        const finalTime = getFinalTime(solve.time, solve.penalty);

        if (solve.penalty === 'DNF') return 'text-red-500';
        if (bestSingleTime && finalTime === bestSingleTime) {
            return 'text-green-500';
        }
        return 'text-white';
    };

    if (!solves || solves.length === 0) {
        return (
            <div className="bg-[#161a23] border border-[#2a2f3a] rounded-xl p-6">
                <h3 className="text-sm font-medium text-zinc-400 mb-4">Recent Solves</h3>
                <p className="text-zinc-500 text-center py-8">
                    No solves yet. Start solving!
                </p>
            </div>
        );
    }

    return (
        <div className="bg-[#161a23] border border-[#2a2f3a] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#2a2f3a] flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-400">
                    Recent Solves <span className="text-zinc-500">({solves.length})</span>
                </h3>
                {/* Up arrow button to view all solves */}
                {onViewAll && solves.length > 3 && (
                    <button
                        onClick={onViewAll}
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        <List className="w-3 h-3" />
                        <span>View All</span>
                        <ChevronUp className="w-3 h-3" />
                    </button>
                )}
            </div>
            <div className="md:hidden p-2">
                {/* Mobile quick view: show last 3 solves horizontally */}
                <div className="flex gap-2 overflow-x-auto">
                    {solves.slice(0, 3).map((solve, idx) => (
                        <div key={solve.id || idx} className="min-w-[120px] bg-[#1b202b] rounded-md px-3 py-2 flex-shrink-0 text-xs text-white">
                            <div className="font-mono">{formatTime(solve.time, solve.penalty)}</div>
                            <div className="text-xs opacity-70">{solve.penalty || '—'}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div
                ref={listRef}
                className="max-h-[40vh] md:max-h-[300px] overflow-y-auto"
            >
                {solves.map((solve, index) => (
                    <div
                        key={solve.id || index}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-[#1e2330] transition-colors border-b border-[#2a2f3a] last:border-0"
                    >
                        <span className="text-xs text-zinc-500 w-8">
                            #{solves.length - index}
                        </span>

                        <span className={`font-mono font-bold text-lg flex-1 ${getTimeClass(solve)}`}>
                            {formatTime(solve.time, solve.penalty)}
                        </span>

                        {solve.penalty === '+2' && (
                            <span className="text-xs text-orange-500 font-medium">+2</span>
                        )}
                        {solve.penalty === 'DNF' && (
                            <span className="text-xs text-red-500 font-medium">DNF</span>
                        )}

                        <div className="flex gap-1">
                            {solve.penalty === 'none' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onUpdatePenalty?.(solve.id, '+2')}
                                    className="h-6 w-6 p-0 text-orange-400 hover:text-orange-300"
                                >
                                    <Plus className="w-3 h-3" />
                                </Button>
                            )}
                            {solve.penalty !== 'DNF' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onUpdatePenalty?.(solve.id, 'DNF')}
                                    className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                                >
                                    <X className="w-3 h-3" />
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDeleteSolve?.(solve.id)}
                                className="h-6 w-6 p-0 text-zinc-500 hover:text-red-400"
                            >
                                <Trash2 className="w-3 h-3" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
