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
import { Eye as EyeIcon } from 'lucide-react';
import { Settings, LogOut, User, Cloud, CloudOff, RefreshCw, Maximize2, Minimize2, Eye, EyeOff, Plus, History, Edit3 } from 'lucide-react';
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
      className={`fixed top-0 left-0 right-0 z-50 bg-[#0f1117]/95 backdrop-blur-sm border-b border-[#161a23] transition-opacity duration-300 ${
        isFullscreen || isFocusMode ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2 py-1 bg-[#161a23] rounded-lg border border-[#2a2f3a]">
            <span className="text-lg">{eventIcon}</span>
            <span className="text-sm text-white font-medium">{eventName}</span>
          </div>
          {/* Header Event Selector (header scope) */}
          <div className="hidden md:block ml-2">
            <EventSelector compact={true} />
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onNewSession}
            className="text-zinc-400 hover:text-white text-xs gap-1"
          >
            <Plus className="w-3 h-3" />
            New
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onViewHistory}
            className="text-zinc-400 hover:text-white text-xs gap-1"
          >
            <History className="w-3 h-3" />
          </Button>
        </div>
        
        <h1 className="text-lg font-bold text-white tracking-wider">TIMER</h1>
        
        <div className="flex items-center gap-2">
          {user && <SyncStatus status={syncStatus} />}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFullscreen}
            className="h-8 w-8 text-zinc-400 hover:text-white"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFocusMode}
            className="h-8 w-8 text-zinc-400 hover:text-white"
            title={isFocusMode ? 'Exit Focus Mode' : 'Focus Mode'}
          >
            {isFocusMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          
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
        {/* Session history quick access in header */}
        <Button variant="ghost" size="icon" onClick={() => setShowSessionHistory(true)} className="text-zinc-400 hover:text-white" title="Sessions">
          <EyeIcon className="w-4 h-4" />
        </Button>
        <SessionHistoryModal
          isOpen={showSessionHistory}
          onClose={() => setShowSessionHistory(false)}
          sessions={sessions}
          currentSessionId={currentSession?.sessionId}
          onLoadSession={(s) => {
            // Switch event if needed and load session data
            if (s.eventId && s.eventId !== currentEvent?.id) {
              switchEvent(s.eventId);
            }
            // Refresh current session data
            refreshSession();
            setShowSessionHistory(false);
          }}
          onDeleteSession={(id) => { /* implement later if needed */ }}
          onRenameSession={(id, name) => { /* implement later if needed */ }}
        />
      </div>
    </header>
  );
}
