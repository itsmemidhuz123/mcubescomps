'use client';

import { useState, useEffect } from 'react';
import { useTimer } from '@/contexts/TimerContext';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, Plus, Edit3, Trash2, FolderOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SessionSelector({ onNewSession, onViewHistory }) {
    const { currentSession, sessions = [], switchEvent, deleteSession, renameSession, createSession, currentEvent } = useTimer();
    const [isOpen, setIsOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const router = useRouter();

    const getSessionDisplayName = (session) => {
        if (!session) return 'Select Session';
        if (session.name) return session.name;
        const eventName = session.eventId === '333' ? '3x3' :
            session.eventId === '222' ? '2x2' :
                session.eventId === '444' ? '4x4' :
                    session.eventId === '555' ? '5x5' :
                        session.eventId === 'pyram' ? 'Pyraminx' :
                            session.eventId === 'minx' ? 'Megaminx' :
                                session.eventId || 'Session';
        const date = session.createdAt ? new Date(session.createdAt).toLocaleDateString() : 'Unknown';
        return `${eventName} - ${date}`;
    };

    const handleSessionSelect = async (sessionId) => {
        const session = sessions.find(s => s.sessionId === sessionId);
        if (session && session.eventId) {
            await switchEvent(session.eventId);
        }
        setIsOpen(false);
    };

    const handleRename = async () => {
        if (editName.trim() && currentSession) {
            await renameSession(currentSession.sessionId, editName.trim());
        }
        setIsEditing(false);
    };

    const handleDelete = async (sessionId, e) => {
        e.stopPropagation();
        if (confirm('Delete this session? This cannot be undone.')) {
            await deleteSession(sessionId);
        }
    };

    const handleNewSession = () => {
        if (onNewSession) onNewSession();
        setIsOpen(false);
    };

    const handleViewHistory = () => {
        if (onViewHistory) onViewHistory();
        setIsOpen(false);
    };

    return (
        <div className="flex items-center gap-1">
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-zinc-300 hover:text-white hover:bg-zinc-800 gap-1"
                    >
                        <FolderOpen className="w-3 h-3" />
                        <span className="max-w-[120px] truncate">
                            {currentSession ? getSessionDisplayName(currentSession) : 'Select Session'}
                        </span>
                        <ChevronDown className="w-3 h-3 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent className="w-64 bg-[#161a23] border-zinc-700 max-h-80 overflow-y-auto">
                    <div className="px-2 py-1.5 text-xs text-zinc-500 font-medium">
                        Sessions ({sessions.length})
                    </div>

                    <DropdownMenuSeparator className="bg-zinc-700" />

                    {sessions && sessions.length > 0 ? (
                        sessions.map((session) => (
                            <DropdownMenuItem
                                key={session?.sessionId}
                                onClick={() => handleSessionSelect(session?.sessionId)}
                                className="flex items-center justify-between text-white hover:bg-zinc-800 cursor-pointer"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="truncate text-sm">
                                        {session?.sessionId === currentSession?.sessionId && (
                                            <span className="text-blue-400 mr-1">●</span>
                                        )}
                                        {getSessionDisplayName(session)}
                                    </div>
                                    <div className="text-xs text-zinc-500">
                                        {session?.solves?.length || 0} solves
                                    </div>
                                </div>
                                {session?.sessionId !== currentSession?.sessionId && (
                                    <button
                                        onClick={(e) => handleDelete(session?.sessionId, e)}
                                        className="p-1 hover:bg-red-900/50 rounded text-zinc-500 hover:text-red-400"
                                        title="Delete session"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                )}
                            </DropdownMenuItem>
                        ))
                    ) : (
                        <div className="px-2 py-4 text-center text-zinc-500 text-sm">
                            No sessions yet
                        </div>
                    )}

                    <DropdownMenuSeparator className="bg-zinc-700" />

                    <DropdownMenuItem
                        onClick={handleNewSession}
                        className="text-blue-400 hover:bg-zinc-800 cursor-pointer"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        New Session
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        onClick={handleViewHistory}
                        className="text-zinc-400 hover:bg-zinc-800 cursor-pointer"
                    >
                        <FolderOpen className="w-4 h-4 mr-2" />
                        View All Sessions
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
