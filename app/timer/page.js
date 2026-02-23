'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TimerProvider, useTimer } from '@/contexts/TimerContext';
import { useSyncManager } from '@/hooks/useSyncManager';
import { useCubingScramble } from '@/hooks/useCubingScramble';
import TimerHeader from '@/app/timer/components/TimerHeader';
import EventSelector from '@/app/timer/components/EventSelector';
import ScrambleCard from '@/app/timer/components/ScrambleCard';
import SolveList from '@/app/timer/components/SolveList';
import StatsPanel from '@/app/timer/components/StatsPanel';
import ScrambleImageModal from '@/app/timer/components/ScrambleImageModal';
import MergeDialog from '@/app/timer/components/MergeDialog';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';

const TIMER_STATES = {
    IDLE: 'idle',
    ARMED: 'armed',
    INSPECTION: 'inspection',
    RUNNING: 'running',
    STOPPED: 'stopped'
};

function TimerEngine({ onSolveComplete, generateScramble }) {
    const { addSolve, settings } = useTimer();
    const [timerState, setTimerState] = useState(TIMER_STATES.IDLE);
    const [displayTime, setDisplayTime] = useState(0);
    const [inspectionTime, setInspectionTime] = useState(15);
    const [pendingSolve, setPendingSolve] = useState(null);
    const [showPenaltyButtons, setShowPenaltyButtons] = useState(false);
    const [inspectionPenalty, setInspectionPenalty] = useState('none');

    const startTimeRef = useRef(null);
    const inspectionStartRef = useRef(null);
    const rafIdRef = useRef(null);
    const inspectionRafIdRef = useRef(null);
    const lastBeepRef = useRef(15);
    const timerStateRef = useRef(timerState);

    useEffect(() => {
        timerStateRef.current = timerState;
    }, [timerState]);

    const formatTime = useCallback((ms) => {
        if (ms < 0) return '0.00';
        const seconds = Math.floor(ms / 1000);
        const centiseconds = Math.floor((ms % 1000) / 10);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (minutes > 0) {
            return `${minutes}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
        }
        return `${secs}.${centiseconds.toString().padStart(2, '0')}`;
    }, []);

    const playBeep = useCallback((frequency = 800, duration = 100) => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            const audioContext = new AudioContext();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration / 1000);
        } catch (e) {
            // Audio not available
        }
    }, []);

    const startTimer = useCallback(() => {
        if (inspectionRafIdRef.current) {
            cancelAnimationFrame(inspectionRafIdRef.current);
            inspectionRafIdRef.current = null;
        }

        setTimerState(TIMER_STATES.RUNNING);
        setInspectionTime(15);
        startTimeRef.current = performance.now();

        const updateDisplay = () => {
            if (startTimeRef.current !== null && timerStateRef.current === TIMER_STATES.RUNNING) {
                const elapsed = performance.now() - startTimeRef.current;
                setDisplayTime(elapsed);
                rafIdRef.current = requestAnimationFrame(updateDisplay);
            }
        };

        rafIdRef.current = requestAnimationFrame(updateDisplay);
    }, []);

    const stopTimer = useCallback(() => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }

        const finalTime = startTimeRef.current !== null ? performance.now() - startTimeRef.current : 0;
        startTimeRef.current = null;

        setTimerState(TIMER_STATES.STOPPED);
        setDisplayTime(finalTime);

        const solve = {
            time: finalTime,
            penalty: inspectionPenalty !== 'none' ? inspectionPenalty : 'none',
            createdAt: Date.now()
        };

        setPendingSolve(solve);
        setShowPenaltyButtons(true);
    }, [inspectionPenalty]);

    const updateInspection = useCallback(() => {
        if (inspectionStartRef.current === null) return;

        const elapsed = performance.now() - inspectionStartRef.current;
        const remaining = Math.max(0, (15 * 1000) - elapsed);
        const remainingSecs = Math.ceil(remaining / 1000);

        setInspectionTime(remainingSecs);

        if (remainingSecs <= 8 && lastBeepRef.current > 8) {
            playBeep(800, 150);
            lastBeepRef.current = 8;
        }
        if (remainingSecs <= 5 && lastBeepRef.current > 5) {
            playBeep(800, 150);
            lastBeepRef.current = 5;
        }
        if (remainingSecs <= 0 && lastBeepRef.current > 0) {
            playBeep(1200, 300);
            lastBeepRef.current = 0;
        }

        const elapsedSecs = elapsed / 1000;
        if (elapsedSecs > 17) {
            setInspectionPenalty('DNF');
            startTimer();
            return;
        }
        if (elapsedSecs > 15 && inspectionPenalty !== '+2') {
            setInspectionPenalty('+2');
        }

        if (timerStateRef.current === TIMER_STATES.INSPECTION) {
            inspectionRafIdRef.current = requestAnimationFrame(updateInspection);
        }
    }, [playBeep, startTimer, inspectionPenalty]);

    const startInspection = useCallback(() => {
        setTimerState(TIMER_STATES.INSPECTION);
        setInspectionTime(15);
        setInspectionPenalty('none');
        lastBeepRef.current = 15;
        inspectionStartRef.current = performance.now();
        inspectionRafIdRef.current = requestAnimationFrame(updateInspection);
    }, [updateInspection]);

    const armTimer = useCallback(() => {
        if (timerState === TIMER_STATES.IDLE || timerState === TIMER_STATES.STOPPED) {
            setTimerState(TIMER_STATES.ARMED);
        }
    }, [timerState]);

    const confirmSolve = useCallback(async (penalty = 'none') => {
        if (!pendingSolve) return;

        const finalPenalty = inspectionPenalty !== 'none' ? inspectionPenalty : penalty;
        const finalSolve = { ...pendingSolve, penalty: finalPenalty };

        await addSolve(finalSolve);

        setPendingSolve(null);
        setShowPenaltyButtons(false);
        setInspectionPenalty('none');
        setTimerState(TIMER_STATES.IDLE);
        setDisplayTime(0);
        setInspectionTime(15);

        generateScramble();
        if (onSolveComplete) onSolveComplete(finalSolve);
    }, [pendingSolve, addSolve, generateScramble, onSolveComplete, inspectionPenalty]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                const currentState = timerStateRef.current;

                if (currentState === TIMER_STATES.RUNNING) {
                    stopTimer();
                } else if (currentState === TIMER_STATES.IDLE) {
                    armTimer();
                } else if (currentState === TIMER_STATES.ARMED) {
                    if (settings.inspectionEnabled) {
                        startInspection();
                    } else {
                        startTimer();
                    }
                }
            }
        };

        const handleKeyUp = (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                const currentState = timerStateRef.current;

                if (currentState === TIMER_STATES.ARMED) {
                    if (settings.inspectionEnabled) {
                        startInspection();
                    } else {
                        startTimer();
                    }
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
    }, [settings.inspectionEnabled, stopTimer, armTimer, startInspection, startTimer]);

    const handlePressStart = useCallback(() => {
        const currentState = timerStateRef.current;

        if (currentState === TIMER_STATES.RUNNING) {
            stopTimer();
        } else if (currentState === TIMER_STATES.IDLE) {
            armTimer();
        } else if (currentState === TIMER_STATES.ARMED) {
            if (settings.inspectionEnabled) {
                startInspection();
            } else {
                startTimer();
            }
        }
    }, [stopTimer, armTimer, startInspection, startTimer, settings.inspectionEnabled]);

    const getTimerColor = useCallback(() => {
        const currentState = timerStateRef.current;

        if (currentState === TIMER_STATES.ARMED) return 'text-green-500';
        if (currentState === TIMER_STATES.RUNNING) return 'text-white';
        if (currentState === TIMER_STATES.INSPECTION) {
            if (inspectionTime <= 3) return 'text-red-500';
            if (inspectionTime <= 8) return 'text-yellow-500';
            return 'text-yellow-400';
        }
        return 'text-white';
    }, [inspectionTime]);

    const getStatusText = useCallback(() => {
        const currentState = timerStateRef.current;

        if (currentState === TIMER_STATES.RUNNING) return 'Press SPACE to stop';
        if (currentState === TIMER_STATES.INSPECTION) return 'Inspection...';
        if (currentState === TIMER_STATES.ARMED) return 'Release to start';
        if (currentState === TIMER_STATES.STOPPED && showPenaltyButtons) return 'Apply penalty or confirm';
        return 'Hold SPACE to start';
    }, [showPenaltyButtons]);

    return {
        timerState,
        displayTime,
        inspectionTime,
        inspectionPenalty,
        formatTime,
        getTimerColor,
        getStatusText,
        handlePressStart,
        showPenaltyButtons,
        pendingSolve,
        confirmSolve
    };
}

function TimerPageContent() {
    const { solves, stats, event, deleteSolve, updateSolvePenalty } = useTimer();
    const eventId = event?.id || '333';
    const { scramble, isLoading, generateScramble } = useCubingScramble(eventId);
    const { syncStatus, showMergePrompt, setShowMergePrompt, syncAllSessions, mergeData } = useSyncManager();

    const [showStats, setShowStats] = useState(false);
    const [currentSolve, setCurrentSolve] = useState(null);
    const [showScrambleImage, setShowScrambleImage] = useState(false);

    const handleSolveComplete = useCallback((solve) => {
        setCurrentSolve(solve.time);
    }, []);

    const timer = TimerEngine({ onSolveComplete: handleSolveComplete, generateScramble });

    const bestSingle = useMemo(() => {
        if (!solves || solves.length === 0) return null;
        const validTimes = solves
            .filter(s => s.penalty !== 'DNF')
            .map(s => s.penalty === '+2' ? s.time + 2000 : s.time);
        return validTimes.length > 0 ? Math.min(...validTimes) : null;
    }, [solves]);

    const handleMerge = useCallback(async () => {
        await mergeData('merge');
    }, [mergeData]);

    const handleKeepLocal = useCallback(async () => {
        await mergeData('local');
    }, [mergeData]);

    const handleDiscard = useCallback(async () => {
        await mergeData('remote');
    }, [mergeData]);

    return (
        <div className="min-h-screen bg-[#0f1117]">
            <TimerHeader syncStatus={syncStatus} onMergeData={syncAllSessions} />

            <main className="pt-20 pb-8 px-4">
                <div className="max-w-2xl mx-auto space-y-4">
                    <EventSelector />

                    <ScrambleCard
                        scramble={scramble}
                        onRefresh={generateScramble}
                        onShowImage={() => setShowScrambleImage(true)}
                        eventId={eventId}
                        isLoading={isLoading}
                    />

                    <div className="text-center py-8">
                        <div
                            className={`text-8xl md:text-9xl font-mono font-bold transition-colors cursor-pointer select-none ${timer.getTimerColor()}`}
                            onTouchStart={timer.handlePressStart}
                        >
                            {timer.timerState === TIMER_STATES.INSPECTION
                                ? timer.inspectionTime
                                : timer.formatTime(timer.displayTime)
                            }
                        </div>
                        <p className="text-zinc-400 mt-4 mb-6">{timer.getStatusText()}</p>

                        {timer.showPenaltyButtons && timer.pendingSolve && (
                            <div className="flex gap-3 justify-center animate-in fade-in">
                                <Button
                                    variant="outline"
                                    onClick={() => timer.confirmSolve('+2')}
                                    className="border-orange-500/50 text-orange-400 hover:bg-orange-500/20"
                                >
                                    +2
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => timer.confirmSolve('DNF')}
                                    className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                                >
                                    DNF
                                </Button>
                                <Button
                                    variant="default"
                                    onClick={() => timer.confirmSolve('none')}
                                    className="bg-green-600 hover:bg-green-700"
                                >
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
            <ScrambleImageModal isOpen={showScrambleImage} onClose={() => setShowScrambleImage(false)} scramble={scramble} eventId={eventId} />
            <MergeDialog isOpen={showMergePrompt} onClose={() => setShowMergePrompt(false)} onMerge={handleMerge} onKeepLocal={handleKeepLocal} onDiscard={handleDiscard} localSessionCount={0} />
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