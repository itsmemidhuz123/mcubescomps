'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, RotateCcw, Calendar, Clock } from 'lucide-react';

export default function SessionHistoryModal({
    isOpen,
    onClose,
    sessions = [],
    onLoadSession,
    onDeleteSession,
    currentSessionId
}) {
    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatTime = (ms) => {
        if (!ms || ms === 0) return '--';
        const seconds = Math.floor(ms / 1000);
        const centiseconds = Math.floor((ms % 1000) / 10);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (minutes > 0) {
            return `${minutes}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
        }
        return `${secs}.${centiseconds.toString().padStart(2, '0')}`;
    };

    const getTotalTime = (solves) => {
        if (!solves || solves.length === 0) return 0;
        return solves.reduce((total, s) => {
            if (s.penalty === 'DNF') return total;
            return total + s.time + (s.penalty === '+2' ? 2000 : 0);
        }, 0);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#0f1117] border-[#2a2f3a] max-w-lg w-[90vw] max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="text-white">Session History</DialogTitle>
                    <DialogDescription className="sr-only">
                        View and manage previous sessions
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="h-[60vh] pr-4">
                    {sessions.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500">
                            No previous sessions found
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {sessions.map((session) => (
                                <div
                                    key={session.sessionId}
                                    className={`p-3 rounded-lg border transition-colors ${session.sessionId === currentSessionId
                                            ? 'bg-blue-600/20 border-blue-600/50'
                                            : 'bg-[#161a23] border-[#2a2f3a] hover:border-[#3a3f4a]'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-3 h-3 text-zinc-500" />
                                            <span className="text-sm text-zinc-400">
                                                {formatDate(session.createdAt)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => onLoadSession(session)}
                                                className="h-7 w-7 text-zinc-400 hover:text-white"
                                                title="Load this session"
                                            >
                                                <RotateCcw className="w-3 h-3" />
                                            </Button>
                                            {session.sessionId !== currentSessionId && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => onDeleteSession(session.sessionId)}
                                                    className="h-7 w-7 text-zinc-400 hover:text-red-400"
                                                    title="Delete session"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                                        <span>{session.solves?.length || 0} solves</span>
                                        <span>Best: {formatTime(session.bestSingle)}</span>
                                        <span>Total: {formatTime(getTotalTime(session.solves))}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
