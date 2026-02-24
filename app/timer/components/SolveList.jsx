'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { formatTime, getFinalTime } from '@/lib/timerStats';
import { Trash2, Plus, X, ChevronUp, List, ChevronDown } from 'lucide-react';

export default function SolveList({
    solves,
    stats,
    bestSingle,
    onDeleteSolve,
    onUpdatePenalty,
    onViewAll,
    showFullList = false
}) {
    const listRef = useRef(null);
    const bestSingleTime = bestSingle;

    // Sort solves by date (newest first)
    const sortedSolves = solves ? [...solves].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : [];
    const recentSolves = sortedSolves.slice(0, 3);

    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = 0;
        }
    }, [solves.length]);

    const getTimeClass = (solve) => {
        const finalTime = getFinalTime(solve.time, solve.penalty);

        if (solve.penalty === 'DNF') return 'text-red-500 dark:text-red-400';
        if (bestSingleTime && finalTime === bestSingleTime) {
            return 'text-green-500 dark:text-green-400';
        }
        return 'text-white dark:text-zinc-100';
    };

    if (!solves || solves.length === 0) {
        return (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4">Recent Solves</h3>
                <p className="text-zinc-400 dark:text-zinc-500 text-center py-8">
                    No solves yet. Start solving!
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                    Recent Solves <span className="text-zinc-400 dark:text-zinc-500">({solves.length})</span>
                </h3>
                {/* View All button */}
                {onViewAll && solves.length > 3 && (
                    <button
                        onClick={onViewAll}
                        className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                        <span>View All</span>
                        <ChevronUp className="w-3 h-3" />
                    </button>
                )}
            </div>

            {/* Inline: show only first 3 solves horizontally on mobile */}
            <div className="p-2">
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {recentSolves.map((solve, idx) => (
                        <div
                            key={solve.id || idx}
                            className="min-w-[100px] flex-shrink-0 bg-zinc-100 dark:bg-zinc-800 rounded-md px-3 py-2"
                        >
                            <div className={`font-mono text-sm font-medium ${getTimeClass(solve)}`}>
                                {formatTime(solve.time, solve.penalty)}
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                {solve.penalty === '+2' ? '+2' : solve.penalty === 'DNF' ? 'DNF' : '—'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Full list: show when requested (modal/drawer) */}
            {showFullList && (
                <div
                    ref={listRef}
                    className="max-h-[40vh] md:max-h-[300px] overflow-y-auto"
                >
                    {sortedSolves.map((solve, index) => (
                        <div
                            key={solve.id || index}
                            className="flex items-center gap-3 px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                        >
                            <span className="text-xs text-zinc-400 dark:text-zinc-500 w-8">
                                #{solves.length - index}
                            </span>

                            <span className={`font-mono font-bold text-base flex-1 ${getTimeClass(solve)}`}>
                                {formatTime(solve.time, solve.penalty)}
                            </span>

                            {solve.penalty === '+2' && (
                                <span className="text-xs text-orange-500 dark:text-orange-400 font-medium">+2</span>
                            )}
                            {solve.penalty === 'DNF' && (
                                <span className="text-xs text-red-500 dark:text-red-400 font-medium">DNF</span>
                            )}

                            <div className="flex gap-1">
                                {solve.penalty === 'none' && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onUpdatePenalty?.(solve.id, '+2')}
                                        className="h-6 w-6 p-0 text-orange-500 dark:text-orange-400 hover:text-orange-600"
                                    >
                                        <Plus className="w-3 h-3" />
                                    </Button>
                                )}
                                {solve.penalty !== 'DNF' && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onUpdatePenalty?.(solve.id, 'DNF')}
                                        className="h-6 w-6 p-0 text-red-500 dark:text-red-400 hover:text-red-600"
                                    >
                                        <X className="w-3 h-3" />
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onDeleteSolve?.(solve.id)}
                                    className="h-6 w-6 p-0 text-zinc-400 hover:text-red-500"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
