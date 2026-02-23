'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { TimerProvider, useTimer } from '@/contexts/TimerContext';
import { useSyncManager } from '@/hooks/useSyncManager';
import { useScrambleEngine } from '@/hooks/useScrambleEngine';
import TimerHeader from '@/app/timer/components/TimerHeader';
import EventSelector from '@/app/timer/components/EventSelector';
import ScrambleCard from '@/app/timer/components/ScrambleCard';
import SolveList from '@/app/timer/components/SolveList';
import StatsPanel from '@/app/timer/components/StatsPanel';
import ScrambleImageModal from '@/app/timer/components/ScrambleImageModal';
import MergeDialog from '@/app/timer/components/MergeDialog';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';
import { TIMER_STATES } from '@/hooks/useTimerEngine';

function TimerEngine({ onSolveComplete, scramble, generateScramble }) {
    const { addSolve, settings } = useTimer();
    const [timerState, setTimerState] = useState(TIMER_STATES.IDLE);
    const [displayTime, setDisplayTime] = useState(0);
    const [inspectionRemaining, setInspectionRemaining] = useState(15);
    const [pendingSolve, setPendingSolve] = useState(null);
    const [showPenaltyButtons, setShowPenaltyButtons] = useState(false);

    const startTimeRef = useState(null);
    const inspectionStartRef = useRef(null);
    const rafIdRef = useRef(null);
    const inspectionRafIdRef = useRef(null);

    const formatTime = (ms) => {
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

    const updateDisplay = useCallback(() => {
        if (startTimeRef.current !== null) {
            const elapsed = performance.now() - startTimeRef.current;
            setDisplayTime(elapsed);
            rafIdRef.current = requestAnimationFrame(updateDisplay);
        }
    }, []);

    const updateInspectionDisplay = useCallback(() => {
        if (inspectionStartRef.current !== null) {
            const elapsed = performance.now() - inspectionStartRef.current;
            const remaining = Math.max(0, (15 * 1000) - elapsed);
            setInspectionRemaining(Math.ceil(remaining / 1000));
            if (remaining <= 0) {
                startTimer();
            } else {
                inspectionRafIdRef.current = requestAnimationFrame(updateInspectionDisplay);
            }
        }
    }, []);

    const startTimer = useCallback(() => {
        if (inspectionRafIdRef.current) {
            cancelAnimationFrame(inspectionRafIdRef.current);
            inspectionRafIdRef.current = null;
        }
        setTimerState(TIMER_STATES.RUNNING);
        setInspectionRemaining(15);
        startTimeRef.current = performance.now();
        rafIdRef.current = requestAnimationFrame(updateDisplay);
    }, [updateDisplay]);

    const stopTimer = useCallback(() => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        const finalTime = startTimeRef.current !== null ? performance.now() - startTimeRef.current : 0;
        startTimeRef.current = null;
        setTimerState(TIMER_STATES.STOPPED);
        setDisplayTime(finalTime);
        const solve = { time: finalTime, penalty: 'none', createdAt: Date.now() };
        setPendingSolve(solve);
        setShowPenaltyButtons(true);
    }, []);

    const startInspection = useCallback(() => {
        setTimerState(TIMER_STATES.INSPECTION);
        setInspectionRemaining(15);
        inspectionStartRef.current = performance.now();
        inspectionRafIdRef.current = requestAnimationFrame(updateInspectionDisplay);
    }, [updateInspectionDisplay]);

    const armTimer = useCallback(() => {
        if (timerState === TIMER_STATES.IDLE || timerState === TIMER_STATES.STOPPED) {
            setTimerState(TIMER_STATES.ARMED);
        }
    }, [timerState]);

    const confirmSolve = useCallback(async (penalty = 'none') => {
        if (!pendingSolve) return;
        const finalSolve = { ...pendingSolve, penalty };
        await addSolve(finalSolve);
        setPendingSolve(null);
        setShowPenaltyButtons(false);
        setTimerState(TIMER_STATES.IDLE);
        setDisplayTime(0);
        generateScramble();
        if (onSolveComplete) onSolveComplete(finalSolve);
    }, [pendingSolve, addSolve, generateScramble, onSolveComplete]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                if (timerState === TIMER_STATES.RUNNING) {
                    stopTimer();
                } else if (timerState === TIMER_STATES.IDLE) {
                    armTimer();
                } else if (timerState === TIMER_STATES.ARMED) {
                    if (settings.inspectionEnabled) startInspection();
                    else startTimer();
                }
            }
        };
        const handleKeyUp = (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (timerState === TIMER_STATES.ARMED) {
                    if (settings.inspectionEnabled) startInspection();
                    else startTimer();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            if (inspectionRafIdRef.current) cancelAnimationFrame(inspectionRafIdRef.current);
        };
    }, [timerState, settings.inspectionEnabled, stopTimer, armTimer, startInspection, startTimer]);

    const getTimerColor = () => {
        if (timerState === TIMER_STATES.ARMED) return 'text-green-500';
        if (timerState === TIMER_STATES.RUNNING) return 'text-white';
        if (timerState === TIMER_STATES.INSPECTION) {
            if (inspectionRemaining <= 3) return 'text-red-500';
            if (inspectionRemaining <= 8) return 'text-yellow-500';
            return 'text-yellow-400';
        }
        return 'text-white';
    };

    const getStatusText = () => {
        if (timerState === TIMER_STATES.RUNNING) return 'Press SPACE to stop';
        if (timerState === TIMER_STATES.INSPECTION) return 'Inspection...';
        if (timerState === TIMER_STATES.ARMED) return 'Release to start';
        if (timerState === TIMER_STATES.STOPPED && showPenaltyButtons) return 'Apply penalty or confirm';
        return 'Hold SPACE to start';
    };

    const handlePressStart = () => {
        if (timerState === TIMER_STATES.RUNNING) stopTimer();
        else if (timerState === TIMER_STATES.IDLE) armTimer();
        else if (timerState === TIMER_STATES.ARMED) {
            if (settings.inspectionEnabled) startInspection();
            else startTimer();
        }
    };

    return {
        timerState,
        displayTime,
        inspectionRemaining,
        formatTime,
        getTimerColor,
        getStatusText,
        handlePressStart,
        showPenaltyButtons,
        pendingSolve,
        confirmSolve
    };
}

import { useRef } from 'react';

function TimerPageContent() {
    const { solves, stats, event, deleteSolve, updateSolvePenalty } = useTimer();
    const { scramble, isLoading, generateScramble } = useScrambleEngine(event?.id);
    const { syncStatus, hasLocalData, showMergePrompt, setShowMergePrompt, syncAllSessions, mergeData } = useSyncManager();

    const [showStats, setShowStats] = useState(false);
    const [currentSolve, setCurrentSolve] = useState(null);
    const [showScrambleImage, setShowScrambleImage] = useState(false);
    const [sessionCount, setSessionCount] = useState(0);

    const handleSolveComplete = useCallback((solve) => {
        setCurrentSolve(solve.time);
    }, []);

    const timer = TimerEngine({ onSolveComplete: handleSolveComplete, scramble, generateScramble });

    const bestSingle = useMemo(() => {
        if (!solves || solves.length === 0) return null;
        const validTimes = solves.filter(s => s.penalty !== 'DNF').map(s => s.penalty === '+2' ? s.time + 2000 : s.time);
        return validTimes.length > 0 ? Math.min(...validTimes) : null;
    }, [solves]);

    const handleMerge = async () => {
        await mergeData('merge');
    };

    const handleKeepLocal = async () => {
        await mergeData('local');
    };

    const handleDiscard = async () => {
        await mergeData('remote');
    };

    return (
        <div className="min-h-screen bg-[#0f1117]">
            <TimerHeader
                syncStatus={syncStatus}
                onMergeData={syncAllSessions}
            />

            <main className="pt-20 pb-8 px-4">
                <div className="max-w-2xl mx-auto space-y-4">
                    <EventSelector />

                    <ScrambleCard
                        scramble={scramble}
                        onRefresh={generateScramble}
                        onShowImage={() => setShowScrambleImage(true)}
                        isLoading={isLoading}
                    />

                    <div className="text-center py-8">
                        <div
                            className={`text-8xl md:text-9xl font-mono font-bold transition-colors cursor-pointer select-none ${timer.getTimerColor()}`}
                            onTouchStart={timer.handlePressStart}
                            onMouseDown={timer.handlePressStart}
                        >
                            {timer.timerState === TIMER_STATES.INSPECTION
                                ? timer.inspectionRemaining
                                : timer.formatTime(timer.displayTime)
                            }
                        </div>
                        <p className="text-zinc-400 mt-4 mb-6">{timer.getStatusText()}</p>

                        {timer.showPenaltyButtons && timer.pendingSolve && (
                            <div className="flex gap-3 justify-center animate-in fade-in">
                                <Button variant="outline" onClick={() => timer.confirmSolve('+2')} className="border-orange-500/50 text-orange-400 hover:bg-orange-500/20">
                                    +2
                                </Button>
                                <Button variant="outline" onClick={() => timer.confirmSolve('DNF')} className="border-red-500/50 text-red-400 hover:bg-red-500/20">
                                    DNF
                                </Button>
                                <Button variant="default" onClick={() => timer.confirmSolve('none')} className="bg-green-600 hover:bg-green-700">
                                    Confirm
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-center">
                        <Button variant="ghost" onClick={() => setShowStats(true)} className="text-zinc-400 hover:text-white">
                            <BarChart3 className="w-4 h-4 mr-2" />View Stats
                        </Button>
                    </div>

                    <SolveList
                        solves={solves}
                        stats={stats}
                        bestSingle={bestSingle}
                        onDeleteSolve={deleteSolve}
                        onUpdatePenalty={updateSolvePenalty}
                    />
                </div>
            </main>

            <StatsPanel isOpen={showStats} onClose={() => setShowStats(false)} stats={stats} currentSolve={currentSolve} />
            <ScrambleImageModal isOpen={showScrambleImage} onClose={() => setShowScrambleImage(false)} scramble={scramble} eventId={event?.id} />
            <MergeDialog isOpen={showMergePrompt} onClose={() => setShowMergePrompt(false)} onMerge={handleMerge} onKeepLocal={handleKeepLocal} onDiscard={handleDiscard} localSessionCount={sessionCount} />
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