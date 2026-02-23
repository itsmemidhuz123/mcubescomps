'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { formatTime } from '@/lib/timerStats';

export default function StatsPanel({ isOpen, onClose, stats, currentSolve }) {
    const statItems = [
        { label: 'Current Solve', value: currentSolve, highlight: false },
        { label: 'Best Single', value: stats?.bestSingle, highlight: true, color: 'text-green-500' },
        { label: 'Ao5', value: stats?.ao5, highlight: stats?.ao5 && stats.totalSolves >= 5 },
        { label: 'Ao12', value: stats?.ao12, highlight: stats?.ao12 && stats.totalSolves >= 12 },
        { label: 'Ao50', value: stats?.ao50, highlight: stats?.ao50 && stats.totalSolves >= 50 },
        { label: 'Ao100', value: stats?.ao100, highlight: stats?.ao100 && stats.totalSolves >= 100 },
        { label: 'Total Solves', value: stats?.totalSolves, highlight: false },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#0f1117] border-[#2a2f3a] max-w-sm w-[90vw]">
                <DialogHeader>
                    <DialogTitle className="text-white">Statistics</DialogTitle>
                    <DialogDescription className="sr-only">
                        Your solve statistics including best single and averages
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    {statItems.map((item) => (
                        <div
                            key={item.label}
                            className={`flex justify-between items-center p-3 rounded-lg ${item.highlight ? 'bg-[#161a23]' : 'bg-transparent'
                                }`}
                        >
                            <span className="text-sm text-zinc-400">{item.label}</span>
                            <span className={`font-mono font-bold text-lg ${item.value === null || item.value === undefined
                                    ? 'text-zinc-600'
                                    : item.color || 'text-white'
                                }`}>
                                {item.value !== null && item.value !== undefined
                                    ? formatTime(item.value)
                                    : '-'
                                }
                            </span>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
