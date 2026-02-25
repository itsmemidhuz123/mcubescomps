'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTimer } from '@/contexts/TimerContext';
import SessionHistoryModal from '@/app/timer/components/SessionHistoryModal';
import SessionSelector from '@/app/timer/components/SessionSelector';
import { Eye as EyeIcon, Maximize2, Minimize2, X } from 'lucide-react';
import { Settings, LogOut, User, Cloud, CloudOff, RefreshCw, Plus } from 'lucide-react';
import Link from 'next/link';
import EventSelector from '@/app/timer/components/EventSelector';
import { useRouter } from 'next/navigation';

const SyncStatus = ({ status }) => {
    const statusConfig = {
        synced: { icon: Cloud, color: 'text-green-500', label: 'Synced' },
        not_synced: { icon: CloudOff, color: 'text-orange-500', label: 'Local' },
        syncing: { icon: RefreshCw, color: 'text-blue-500', label: 'Syncing...' },
        error: { icon: CloudOff, color: 'text-red-500', label: 'Sync Error' }
    };

    const config = statusConfig[status] || statusConfig.not_synced;
    const Icon = config.icon;

    return (
        <div className={`flex items-center gap-2 text-xs ${config.color}`}>
            <Icon className={`w-3 h-3 ${status === 'syncing' ? 'animate-spin' : ''}`} />
            <span>{config.label}</span>
        </div>
    );
};

export default function TimerHeader({
    syncStatus = 'not_synced',
    onMergeData,
    onSettingsClick,
    isFullscreen = false,
    onToggleFullscreen,
    isFocusMode = false,
    onToggleFocusMode,
    sessionName = 'Session 1',
    onNewSession,
    onViewHistory,
    onRenameSession,
    eventIcon = '🎲',
    eventName = '3x3x3'
}) {
    const { user, userProfile, signOut } = useAuth();
    const { currentEvent, currentSession, sessions, switchEvent, createSession, refreshSession } = useTimer();
    const [showSessionHistory, setShowSessionHistory] = useState(false);
    const router = useRouter();
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSignOut = async () => {
        await signOut();
        router.push('/');
    };

    const handleMergeData = async () => {
        if (onMergeData) {
            setIsSyncing(true);
            await onMergeData();
            setIsSyncing(false);
        }
    };

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 bg-[#0f1117]/95 backdrop-blur-sm border-b border-[#161a23] transition-opacity duration-300 ${isFullscreen || isFocusMode ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}
        >
            <div className="flex items-center justify-between px-2 py-2 md:px-4 md:py-3">
                {/* Left Section - Event + Session */}
                <div className="flex items-center gap-1 md:gap-2 flex-1 min-w-0">
                    {/* Close Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push('/')}
                        className="h-8 w-8 text-zinc-400 hover:text-white shrink-0"
                        title="Close Timer"
                    >
                        <X className="w-4 h-4" />
                    </Button>

                    {/* Event Selector */}
                    <div className="shrink-0">
                        <EventSelector compact={true} />
                    </div>
                </div>

                {/* Center - Title (Desktop only) */}
                <h1 className="text-lg font-bold text-white tracking-wider hidden md:block mx-2">TIMER</h1>

                {/* Right Section - Actions */}
                <div className="flex items-center gap-1 shrink-0">
                    {/* Quick New Session - Mobile */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onNewSession}
                        className="h-8 w-8 text-zinc-400 hover:text-white"
                        title="New Session"
                    >
                        <Plus className="w-4 h-4" />
                    </Button>

                    {/* Sync Status */}
                    {user && <SyncStatus status={syncStatus} />}

                    {/* Settings */}
                    <Link href="/timer/settings">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-zinc-400 hover:text-white"
                            title="Settings"
                        >
                            <Settings className="w-4 h-4" />
                        </Button>
                    </Link>

                    {/* User Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
                                <Avatar className="h-7 w-7">
                                    <AvatarImage src={userProfile?.photoURL || user?.photoURL} alt={user?.displayName} />
                                    <AvatarFallback className="bg-[#161a23] text-white text-xs">
                                        {user?.email?.charAt(0).toUpperCase() || 'G'}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48 bg-[#161a23] border-[#2a2f3a]" align="end" forceMount>
                            {user ? (
                                <>
                                    <DropdownMenuItem className="flex items-center gap-2 text-white focus:bg-[#2a2f3a] focus:text-white">
                                        <User className="w-4 h-4" />
                                        <span className="text-sm">{userProfile?.displayName || user.email}</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator className="bg-[#2a2f3a]" />

                                    <DropdownMenuItem asChild className="focus:bg-[#2a2f3a] focus:text-white">
                                        <Link href="/timer/settings" className="flex items-center gap-2 text-white cursor-pointer">
                                            <Settings className="w-4 h-4" />
                                            <span>Timer Settings</span>
                                        </Link>
                                    </DropdownMenuItem>

                                    {onMergeData && (
                                        <DropdownMenuItem
                                            onClick={handleMergeData}
                                            disabled={isSyncing}
                                            className="flex items-center gap-2 text-white focus:bg-[#2a2f3a] focus:text-white"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                            <span>{isSyncing ? 'Syncing...' : 'Sync Timer Data'}</span>
                                        </DropdownMenuItem>
                                    )}

                                    <DropdownMenuSeparator className="bg-[#2a2f3a]" />

                                    <DropdownMenuItem
                                        onClick={handleSignOut}
                                        className="flex items-center gap-2 text-red-400 focus:bg-[#2a2f3a] focus:text-red-400"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        <span>Sign Out</span>
                                    </DropdownMenuItem>
                                </>
                            ) : (
                                <>
                                    <DropdownMenuItem asChild className="focus:bg-[#2a2f3a] focus:text-white">
                                        <Link href="/login" className="flex items-center gap-2 text-white cursor-pointer">
                                            <User className="w-4 h-4" />
                                            <span>Sign In</span>
                                        </Link>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem asChild className="focus:bg-[#2a2f3a] focus:text-white">
                                        <Link href="/timer/settings" className="flex items-center gap-2 text-white cursor-pointer">
                                            <Settings className="w-4 h-4" />
                                            <span>Timer Settings</span>
                                        </Link>
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}
