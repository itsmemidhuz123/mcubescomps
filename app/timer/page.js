'use client';

import { useState, useEffect, useCallback } from 'react';
import { TimerProvider, useTimer } from '@/contexts/TimerContext';
import { useCubingScramble } from '@/hooks/useCubingScramble';
import TimerHeader from '@/app/timer/components/TimerHeader';
import ScrambleCard from '@/app/timer/components/ScrambleCard';
import TimerDisplay from '@/app/timer/components/TimerDisplay';
import SolveList from '@/app/timer/components/SolveList';
import SessionSelector from '@/app/timer/components/SessionSelector';
import SolveDrawer from '@/app/timer/components/SolveDrawer';
import NewSessionDialog from '@/app/timer/components/NewSessionDialog';
import SessionHistoryModal from '@/app/timer/components/SessionHistoryModal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Settings, Eye, Maximize2, Minimize2, Plus, List } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function TimerPageContent() {
    const { currentEvent, currentSession, sessions, solves, settings, createSession, stats, deleteSolve, updateSolvePenalty } = useTimer();
    const eventId = currentEvent?.id ?? '333';
    const { scramble, isLoading: scrambleLoading, generateScramble } = useCubingScramble(eventId);

    const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
    const [showSessionHistory, setShowSessionHistory] = useState(false);
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showSolveDrawer, setShowSolveDrawer] = useState(false);

    const router = useRouter();

    const handleNewSession = async () => {
        if (typeof createSession === 'function') {
            await createSession();
            setShowNewSessionDialog(false);
        }
    };

    const toggleFocusMode = useCallback(() => {
        setIsFocusMode(prev => !prev);
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
            }
        };
        window.addEventListener('keydown', handleKeyDown, { passive: false });
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleCloseTimer = () => {
        router.push('/');
    };

    const formatTime = (ms) => {
        if (ms === null || ms === undefined || ms === 0) return '0.00';
        const seconds = Math.floor(ms / 1000);
        const centiseconds = Math.floor((ms % 1000) / 10);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;

        if (minutes > 0) {
            return `${minutes}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
        }
        return `${secs}.${centiseconds.toString().padStart(2, '0')}`;
    };

    const eventIcon = currentEvent?.icon || '🎲';
    const eventName = currentEvent?.name || '3x3x3';

    const sortedSolves = solves ? [...solves].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : [];

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            {/* Timer Header - replaces global Navbar */}
            <TimerHeader
                syncStatus="not_synced"
                isFullscreen={isFullscreen}
                onToggleFullscreen={toggleFullscreen}
                isFocusMode={isFocusMode}
                onToggleFocusMode={toggleFocusMode}
                sessionName={currentSession?.name || 'Session 1'}
                onNewSession={() => setShowNewSessionDialog(true)}
                onViewHistory={() => setShowSessionHistory(true)}
                onSettingsClick={() => router.push('/timer/settings')}
                eventIcon={eventIcon}
                eventName={eventName}
            />

            {/* Main Content */}
            <main className={`pt-14 px-2 py-3 pb-20 transition-all duration-300 ${isFocusMode ? 'opacity-0 pointer-events-none absolute inset-0' : ''}`}>
                {/* Stats Bar with Session on Mobile */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-zinc-900/80 rounded-lg p-2.5 text-center border border-zinc-800">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Best</div>
                        <div className="text-base font-bold text-green-400">{stats?.bestSingle ? formatTime(stats.bestSingle) : '--'}</div>
                    </div>
                    <div className="bg-zinc-900/80 rounded-lg p-2.5 text-center border border-zinc-800">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Ao5</div>
                        <div className="text-base font-bold text-blue-400">{stats?.ao5 ? formatTime(stats.ao5) : '--'}</div>
                    </div>
                    <div className="bg-zinc-900/80 rounded-lg p-2.5 text-center border border-zinc-800">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Solves</div>
                        <div className="text-base font-bold text-purple-400">{stats?.totalSolves || 0}</div>
                    </div>
                </div>

                {/* Session Controls Bar - below stats */}
                <div className="mb-3 flex items-center justify-between">
                    {/* Statistics Button - left */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSolveDrawer(true)}
                        className="text-zinc-400 hover:text-white"
                    >
                        <List className="w-4 h-4 mr-1" />
                        <span className="text-sm">Stats</span>
                    </Button>

                    {/* Session Selector - center */}
                    <SessionSelector
                        onNewSession={() => setShowNewSessionDialog(true)}
                        onViewHistory={() => setShowSessionHistory(true)}
                    />

                    {/* Focus & Fullscreen - right */}
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleFocusMode}
                            className="h-8 w-8 text-zinc-400 hover:text-white"
                            title="Focus Mode"
                        >
                            <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleFullscreen}
                            className="h-8 w-8 text-zinc-400 hover:text-white"
                            title="Fullscreen"
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>

                {/* Timer & Scramble Grid */}
                <div className="grid grid-cols-1 gap-3">
                    {/* Timer Section */}
                    <div className="order-1">
                        <TimerDisplay
                            onTimerStop={() => { }}
                            onGenerateScramble={generateScramble}
                        />
                    </div>

                    {/* Scramble Section */}
                    <div className="order-2">
                        <ScrambleCard
                            scramble={scramble}
                            eventId={eventId}
                            isLoading={scrambleLoading}
                            onRefresh={generateScramble}
                        />
                    </div>
                </div>

                {/* Recent Solves */}
                <section className="mt-3">
                    <Card className="bg-zinc-900/80 border-zinc-800 rounded-lg">
                        <CardContent className="p-3">
                            <h3 className="text-sm font-semibold text-zinc-300 mb-2">Recent Solves</h3>
                            <SolveList solves={solves} />
                        </CardContent>
                    </Card>
                </section>
            </main>

            {/* Focus Mode - Timer + Scramble + View Solves Button */}
            {isFocusMode && (
                <div className="fixed inset-0 bg-zinc-950 z-40 flex flex-col">
                    {/* Top Right Controls */}
                    <div className="absolute top-14 right-4 flex items-center gap-2 z-50">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowSolveDrawer(true)}
                            className="h-10 w-10 text-zinc-400 hover:text-white bg-zinc-900/50"
                            title="View All Solves"
                        >
                            <List className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleFullscreen}
                            className="h-10 w-10 text-zinc-400 hover:text-white bg-zinc-900/50"
                            title="Fullscreen"
                        >
                            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCloseTimer}
                            className="h-10 w-10 text-zinc-400 hover:text-red-400 bg-zinc-900/50"
                            title="Close Timer"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 overflow-auto">
                        <div className="w-full max-w-md">
                            <TimerDisplay
                                onTimerStop={() => { }}
                                onGenerateScramble={generateScramble}
                            />
                        </div>

                        <div className="w-full max-w-md mt-4">
                            <ScrambleCard
                                scramble={scramble}
                                eventId={eventId}
                                isLoading={scrambleLoading}
                                onRefresh={generateScramble}
                            />
                        </div>

                        {/* View Solves Button */}
                        <Button
                            variant="outline"
                            onClick={() => setShowSolveDrawer(true)}
                            className="mt-4 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
                        >
                            <List className="w-4 h-4 mr-2" />
                            View All Solves ({sortedSolves.length})
                        </Button>
                    </div>

                    {/* Exit Hint */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                        <Button
                            variant="ghost"
                            onClick={toggleFocusMode}
                            className="text-zinc-500 hover:text-white text-sm"
                        >
                            Tap to exit focus mode
                        </Button>
                    </div>
                </div>
            )}

            {/* Fullscreen Mode - Stats + Scramble + Timer + Solves */}
            {isFullscreen && !isFocusMode && (
                <div className="fixed inset-0 bg-zinc-950 z-40 overflow-auto">
                    {/* Top Right Controls */}
                    <div className="sticky top-2 right-4 flex items-center gap-2 z-50 float-right">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleFocusMode}
                            className="h-10 w-10 text-zinc-400 hover:text-white bg-zinc-900/50"
                            title="Focus Mode"
                        >
                            <Eye className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleFullscreen}
                            className="h-10 w-10 text-zinc-400 hover:text-white bg-zinc-900/50"
                            title="Exit Fullscreen"
                        >
                            <Minimize2 className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCloseTimer}
                            className="h-10 w-10 text-zinc-400 hover:text-red-400 bg-zinc-900/50"
                            title="Close Timer"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="p-4 max-w-2xl mx-auto">
                        {/* Stats Bar */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <div className="bg-zinc-900/80 rounded-lg p-3 text-center border border-zinc-800">
                                <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Best</div>
                                <div className="text-xl font-bold text-green-400">{stats?.bestSingle ? formatTime(stats.bestSingle) : '--'}</div>
                            </div>
                            <div className="bg-zinc-900/80 rounded-lg p-3 text-center border border-zinc-800">
                                <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Ao5</div>
                                <div className="text-xl font-bold text-blue-400">{stats?.ao5 ? formatTime(stats.ao5) : '--'}</div>
                            </div>
                            <div className="bg-zinc-900/80 rounded-lg p-3 text-center border border-zinc-800">
                                <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Solves</div>
                                <div className="text-xl font-bold text-purple-400">{stats?.totalSolves || 0}</div>
                            </div>
                        </div>

                        {/* Timer */}
                        <TimerDisplay
                            onTimerStop={() => { }}
                            onGenerateScramble={generateScramble}
                        />

                        {/* Scramble */}
                        <div className="mt-4">
                            <ScrambleCard
                                scramble={scramble}
                                eventId={eventId}
                                isLoading={scrambleLoading}
                                onRefresh={generateScramble}
                            />
                        </div>

                        {/* Recent Solves */}
                        <div className="mt-4">
                            <Card className="bg-zinc-900/80 border-zinc-800 rounded-lg">
                                <CardContent className="p-3">
                                    <h3 className="text-sm font-semibold text-zinc-300 mb-2">Recent Solves</h3>
                                    <SolveList solves={solves} />
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            )}

            <NewSessionDialog
                isOpen={showNewSessionDialog}
                onClose={() => setShowNewSessionDialog(false)}
                onConfirm={handleNewSession}
                sessionName={currentSession?.name || 'Current Session'}
            />

            <SessionHistoryModal
                isOpen={showSessionHistory}
                onClose={() => setShowSessionHistory(false)}
                sessions={sessions}
                currentSessionId={currentSession?.sessionId}
            />

            <SolveDrawer
                isOpen={showSolveDrawer}
                onClose={() => setShowSolveDrawer(false)}
                solves={sortedSolves}
                onDeleteSolve={deleteSolve}
                onUpdatePenalty={updateSolvePenalty}
            />
        </div>
    );
}

export default function TimerPage() {
    return (
        <TimerProvider>
            <TimerPageContent />
        </TimerProvider>
    );
}