'use client';

import { useState, useEffect } from 'react';
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
import { Settings, LogOut, User, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const SyncStatus = ({ status }) => {
    const statusConfig = {
        synced: { icon: Cloud, color: 'text-green-500', label: 'Synced' },
        not_synced: { icon: CloudOff, color: 'text-orange-500', label: 'Not Synced' },
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

export default function TimerHeader({ syncStatus = 'not_synced', onMergeData, onSettingsClick }) {
    const { user, userProfile, signOut } = useAuth();
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
        <header className="fixed top-0 left-0 right-0 z-50 bg-[#0f1117]/95 backdrop-blur-sm border-b border-[#161a23]">
            <div className="flex items-center justify-between px-4 py-3">
                <div className="flex-1" />

                <h1 className="text-lg font-bold text-white tracking-wider">TIMER</h1>

                <div className="flex-1 flex justify-end items-center gap-3">
                    {user && <SyncStatus status={syncStatus} />}

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={userProfile?.photoURL || user?.photoURL} alt={user?.displayName} />
                                    <AvatarFallback className="bg-[#161a23] text-white text-sm">
                                        {user?.email?.charAt(0).toUpperCase() || '?'}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 bg-[#161a23] border-[#2a2f3a]" align="end" forceMount>
                            {user ? (
                                <>
                                    <DropdownMenuItem className="flex items-center gap-2 text-white focus:bg-[#2a2f3a] focus:text-white">
                                        <User className="w-4 h-4" />
                                        <span>{userProfile?.displayName || user.email}</span>
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
                                            <span>Sync Now</span>
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
                                        <Link href="/auth/login" className="flex items-center gap-2 text-white cursor-pointer">
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