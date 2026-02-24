'use client';

import { useState, useEffect, useCallback } from 'react';
import { TimerProvider, useTimer } from '@/contexts/TimerContext';
import { useSyncManager } from '@/hooks/useSyncManager';
import { useCubingScramble } from '@/hooks/useCubingScramble';
import TimerDisplay from '@/app/timer/components/TimerDisplay';
import ScrambleCard from '@/app/timer/components/ScrambleCard';
import SolveList from '@/app/timer/components/SolveList';
import StatsPanel from '@/app/timer/components/StatsPanel';
import ScrambleImageModal from '@/app/timer/components/ScrambleImageModal';
import FloatingScrambleImage from '@/app/timer/components/FloatingScrambleImage';
import SessionHistoryModal from '@/app/timer/components/SessionHistoryModal';
import NewSessionDialog from '@/app/timer/components/NewSessionDialog';
import EventSelector from '@/app/timer/components/EventSelector';
import SessionSelector from '@/app/timer/components/SessionSelector';
import SolveDrawer from '@/app/timer/components/SolveDrawer';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Maximize2, Minimize2, Settings, Plus, History, Cloud, CloudOff } from 'lucide-react';
import Link from 'next/link';

function StatBox({ label, value, highlight = 'blue', className = '' }) {
    const colors = {
        green: "bg-green-500/20 border-green-500/30 text-green-400",
        blue: "bg-blue-500/20 border-blue-500/30 text-blue-400",
        red: "bg-red-500/20 border-red-500/30 text-red-400",
        purple: "bg-purple-500/20 border-purple-500/30 text-purple-400",
        orange: "bg-orange-500/20 border-orange-500/30 text-orange-400",
    };

    return (
        <div className={`p-3 rounded-lg border ${colors[highlight]} ${className}`}>
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
            <div className="font-mono font-semibold text-lg">{value}</div>
        </div>
    );
}

function TimerPageContent() {
    const { solves, stats, event, deleteSolve, updateSolvePenalty, currentSession, sessions, switchEvent, createSession, refreshSession, settings, isLoading: isSettingsLoading } = useTimer();
    const eventId = event?.id || '333';
    const { scramble, isLoading: scrambleLoading, generateScramble } = useCubingScramble(eventId);
    const { syncStatus, showMergePrompt, setShowMergePrompt, syncAllSessions, mergeData } = useSyncManager();

    const [showStats, setShowStats] = useState(false);
    const [showSolvesDrawer, setShowSolvesDrawer] = useState(false);
    const [currentSolve, setCurrentSolve] = useState(null);
    const [showScrambleImageModal, setShowScrambleImageModal] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [showSessionHistory, setShowSessionHistory] = useState(false);
    const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
    const [showPBAnimation, setShowPBAnimation] = useState(false);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                setIsFullscreen(true);
            }).catch(() => { });
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false);
            }).catch(() => { });
        }
    }, []);

    const toggleFocusMode = useCallback(() => {
        setIsFocusMode(prev => !prev);
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const handleNewSession = async () => {
        await createSession();
        await generateScramble();
        setShowNewSessionDialog(false);
    };

    const formatTime = (ms) => {
        if (ms === null || ms === undefined) return '--';
        if (ms < 0) return '0.00';
        const seconds = Math.floor(ms / 1000);
        const centiseconds = Math.floor((ms % 1000) / 10);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;

        if (minutes > 0) {
            return `${minutes}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
        }
        return `${secs}.${centiseconds.toString().padStart(2, '0')}`;
    };

    const formatAo = (ao) => {
        if (!ao) return '--';
        return formatTime(ao);
    };

    if (isSettingsLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
                <div className="text-white">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f1117] text-white">
            {/* Background gradient */}
            {!isFullscreen && (
                <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent pointer-events-none" />
            )}

            {/* Header */}
            {!isFullscreen && !isFocusMode && (
                <header className="sticky top-0 z-30 bg-[#0f1117]/95 backdrop-blur-md border-b border-zinc-800">
                    <div className="container mx-auto px-4 h-14 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <EventSelector compact={true} />
                            <SessionSelector
                                onNewSession={() => setShowNewSessionDialog(true)}
                                onViewHistory={() => setShowSessionHistory(true)}
                            />
                        </div>

                        <h1 className="text-lg font-bold tracking-wider">TIMER</h1>

                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={toggleFocusMode}
                                className="text-zinc-400 hover:text-white"
                            >
                                <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={toggleFullscreen}
                                className="text-zinc-400 hover:text-white"
                            >
                                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            </Button>
                            <Link href="/timer/settings">
                                <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
                                    <Settings className="w-4 h-4" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </header>
            )}

            {/* Focus Mode Header */}
            {isFocusMode && !isFullscreen && (
                <header className="sticky top-0 z-30 bg-[#0f1117]/95 backdrop-blur-md border-b border-zinc-800">
                    <div className="container mx-auto px-4 h-14 flex items-center justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleFocusMode}
                            className="text-zinc-400 hover:text-white"
                        >
                            <EyeOff className="w-4 h-4 mr-1" />
                            <span className="text-xs">Exit</span>
                        </Button>
                    </div>
                </header>
            )}

            {/* Main Content */}
            <main className={`container mx-auto px-4 py-8 ${isFocusMode ? 'pt-20' : ''}`}>
                <div className="max-w-2xl mx-auto space-y-8">
                    {/* Timer Display */}
                    <TimerDisplay
                        onTimerStop={(solve) => setCurrentSolve(solve.time)}
                        onGenerateScramble={generateScramble}
                    />

                    {/* Scramble */}
                    {!isFocusMode && (
                        <ScrambleCard
                            scramble={scramble}
                            eventId={eventId}
                            isLoading={scrambleLoading}
                            onRefresh={generateScramble}
                        />
                    )}

                    {/* Stats */}
                    {!isFocusMode && settings.showSessionStatsPanel && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <StatBox label="Best" value={formatTime(stats.bestSingle)} highlight="green" />
                            <StatBox label="Ao5" value={formatAo(stats.ao5)} highlight="blue" />
                            <StatBox label="Ao12" value={formatAo(stats.ao12)} highlight="purple" />
                            <StatBox label="Solves" value={stats.totalSolves || 0} highlight="orange" />
                        </div>
                    )}

                    {/* Recent Solves */}
                    {!isFocusMode && (
                        <SolveList
                            solves={solves}
                            onDelete={deleteSolve}
                            onUpdatePenalty={updateSolvePenalty}
                            onViewAll={() => setShowSolvesDrawer(true)}
                        />
                    )}
                </div>
            </main>

            {/* Floating Scramble Image */}
            {settings.showScrambleImage && scramble && !isFocusMode && (
                <FloatingScrambleImage
                    scramble={scramble}
                    eventId={eventId}
                />
            )}

            {/* Modals */}
            <SolveDrawer
                isOpen={showSolvesDrawer}
                onClose={() => setShowSolvesDrawer(false)}
                solves={solves}
                onDeleteSolve={deleteSolve}
                onUpdatePenalty={updateSolvePenalty}
            />

            <SessionHistoryModal
                isOpen={showSessionHistory}
                onClose={() => setShowSessionHistory(false)}
                sessions={sessions}
                currentSessionId={currentSession?.sessionId}
                onLoadSession={switchEvent}
                onDeleteSession={deleteSession}
            />

            <NewSessionDialog
                isOpen={showNewSessionDialog}
                onClose={() => setShowNewSessionDialog(false)}
                onConfirm={handleNewSession}
                sessionName={currentSession?.name || 'Current Session'}
            />

            <ScrambleImageModal
                open={showScrambleImageModal}
                onClose={() => setShowScrambleImageModal(false)}
                scramble={scramble}
                eventId={eventId}
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