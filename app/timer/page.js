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
    INSPECTION_ARMED: 'inspection_armed',
    RUNNING: 'running',
    STOPPED: 'stopped'
};

function TimerEngine({ onSolveComplete, generateScramble }) {
    const { addSolve, settings } = useTimer();
    const [timerState, setTimerState] = useState(TIMER_STATES.IDLE);
    const [displayTime, setDisplayTime] = useState(0);
    const [inspectionRemaining, setInspectionRemaining] = useState(15);
    const [pendingSolve, setPendingSolve] = useState(null);
    const [showPenaltyButtons, setShowPenaltyButtons] = useState(false);
    const [inspectionPenalty, setInspectionPenalty] = useState('none');

    const startTimeRef = useRef(null);
    const inspectionStartRef = useRef(null);
    const rafIdRef = useRef(null);
    const inspectionRafIdRef = useRef(null);
    const lastBeepRef = useRef(15);
    const timerStateRef = useRef(timerState);
    const audioContextRef = useRef(null);

    useEffect(() => {
        timerStateRef.current = timerState;
    }, [timerState]);

    const getAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                audioContextRef.current = new AudioContext();
            }
        }
        return audioContextRef.current;
    }, []);

    const playBeep = useCallback((frequency = 800, duration = 150) => {
        try {
            const audioContext = getAudioContext();
            if (!audioContext) return;

            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }

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
    }, [getAudioContext]);

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

    const startTimer = useCallback((penalty = 'none') => {
        if (inspectionRafIdRef.current) {
            cancelAnimationFrame(inspectionRafIdRef.current);
            inspectionRafIdRef.current = null;
        }

        setInspectionPenalty(penalty);
        setTimerState(TIMER_STATES.RUNNING);
        setInspectionRemaining(15);
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
            penalty: inspectionPenalty,
            createdAt: Date.now()
        };

        setPendingSolve(solve);
        setShowPenaltyButtons(true);
    }, [inspectionPenalty]);

    const updateInspection = useCallback(() => {
        if (inspectionStartRef.current === null) return;

        const elapsed = performance.now() - inspectionStartRef.current;
        const elapsedSecs = elapsed / 1000;
        const remaining = Math.max(0, 15 - elapsedSecs);
        const remainingSecs = Math.ceil(remaining);

        setInspectionRemaining(remainingSecs);

        // Beep at 8 seconds remaining
        if (remainingSecs <= 8 && lastBeepRef.current > 8) {
            playBeep(800, 150);
            lastBeepRef.current = 8;
        }
        // Beep at 5 seconds remaining
        if (remainingSecs <= 5 && lastBeepRef.current > 5) {
            playBeep(800, 150);
            lastBeepRef.current = 5;
        }
        // Beep at 0 seconds (time's up)
        if (remainingSecs <= 0 && lastBeepRef.current > 0) {
            playBeep(1200, 300);
            lastBeepRef.current = 0;
        }

        if (timerStateRef.current === TIMER_STATES.INSPECTION ||
            timerStateRef.current === TIMER_STATES.INSPECTION_ARMED) {
            inspectionRafIdRef.current = requestAnimationFrame(updateInspection);
        }
    }, [playBeep]);

    const startInspection = useCallback(() => {
        setTimerState(TIMER_STATES.INSPECTION);
        setInspectionRemaining(15);
        setInspectionPenalty('none');
        lastBeepRef.current = 15;
        inspectionStartRef.current = performance.now();
        inspectionRafIdRef.current = requestAnimationFrame(updateInspection);
    }, [updateInspection]);

    const armTimer = useCallback(() => {
        const currentState = timerStateRef.current;
        if (currentState === TIMER_STATES.IDLE || currentState === TIMER_STATES.STOPPED) {
            setTimerState(TIMER_STATES.ARMED);
        } else if (currentState === TIMER_STATES.INSPECTION) {
            setTimerState(TIMER_STATES.INSPECTION_ARMED);
        }
    }, []);

    const unarmTimer = useCallback(() => {
        const currentState = timerStateRef.current;
        if (currentState === TIMER_STATES.ARMED) {
            setTimerState(TIMER_STATES.IDLE);
        } else if (currentState === TIMER_STATES.INSPECTION_ARMED) {
            setTimerState(TIMER_STATES.INSPECTION);
        }
    }, []);

    const releaseFromArmed = useCallback(() => {
        const currentState = timerStateRef.current;

        if (currentState === TIMER_STATES.ARMED) {
            if (settings.inspectionEnabled) {
                startInspection();
            } else {
                startTimer('none');
            }
        } else if (currentState === TIMER_STATES.INSPECTION_ARMED) {
            // Calculate penalty based on elapsed inspection time
            if (inspectionStartRef.current !== null) {
                const elapsed = performance.now() - inspectionStartRef.current;
                const elapsedSecs = elapsed / 1000;

                let penalty = 'none';
                if (elapsedSecs > 17) {
                    penalty = 'DNF';
                } else if (elapsedSecs > 15) {
                    penalty = '+2';
                }

                startTimer(penalty);
            } else {
                startTimer('none');
            }
        }
    }, [settings.inspectionEnabled, startInspection, startTimer]);

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
        setInspectionRemaining(15);
        inspectionStartRef.current = null;

        generateScramble();
        if (onSolveComplete) onSolveComplete(finalSolve);
    }, [pendingSolve, addSolve, generateScramble, onSolveComplete, inspectionPenalty]);

    // Keyboard handlers
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                const currentState = timerStateRef.current;

                if (currentState === TIMER_STATES.RUNNING) {
                    stopTimer();
                } else if (currentState === TIMER_STATES.IDLE || currentState === TIMER_STATES.STOPPED) {
                    armTimer();
                } else if (currentState === TIMER_STATES.INSPECTION) {
                    armTimer(); // Arm in inspection state
                }
            }
        };

        const handleKeyUp = (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                releaseFromArmed();
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
    }, [stopTimer, armTimer, releaseFromArmed]);

    // Touch handlers
    const handleTouchStart = useCallback((e) => {
        e.preventDefault();
        const currentState = timerStateRef.current;

        if (currentState === TIMER_STATES.RUNNING) {
            stopTimer();
        } else if (currentState === TIMER_STATES.IDLE || currentState === TIMER_STATES.STOPPED) {
            armTimer();
        } else if (currentState === TIMER_STATES.INSPECTION) {
            armTimer();
        }
    }, [stopTimer, armTimer]);

    const handleTouchEnd = useCallback((e) => {
        e.preventDefault();
        releaseFromArmed();
    }, [releaseFromArmed]);

    const getTimerColor = useCallback(() => {
        const currentState = timerStateRef.current;

        if (currentState === TIMER_STATES.ARMED || currentState === TIMER_STATES.INSPECTION_ARMED) {
            return 'text-green-500';
        }
        if (currentState === TIMER_STATES.RUNNING) {
            return 'text-white';
        }
        if (currentState === TIMER_STATES.INSPECTION) {
            if (inspectionRemaining <= 0) return 'text-red-500 animate-pulse';
            if (inspectionRemaining <= 3) return 'text-red-500';
            if (inspectionRemaining <= 8) return 'text-yellow-500';
            return 'text-yellow-400';
        }
        return 'text-white';
    }, [inspectionRemaining]);

    const getStatusText = useCallback(() => {
        const currentState = timerStateRef.current;

        if (currentState === TIMER_STATES.RUNNING) return 'Press SPACE or tap to stop';
        if (currentState === TIMER_STATES.INSPECTION) return 'Hold SPACE or tap to start';
        if (currentState === TIMER_STATES.INSPECTION_ARMED) return 'Release to start';
        if (currentState === TIMER_STATES.ARMED) return 'Release to start';
        if (currentState === TIMER_STATES.STOPPED && showPenaltyButtons) return 'Apply penalty or confirm';
        return 'Hold SPACE or tap to start';
    }, [showPenaltyButtons]);

    const getDisplayValue = useCallback(() => {
        const currentState = timerStateRef.current;

        if (currentState === TIMER_STATES.INSPECTION || currentState === TIMER_STATES.INSPECTION_ARMED) {
            return inspectionRemaining;
        }
        return formatTime(displayTime);
    }, [inspectionRemaining, displayTime, formatTime]);

    return {
        timerState,
        displayTime,
        inspectionRemaining,
        inspectionPenalty,
        formatTime,
        getTimerColor,
        getStatusText,
        getDisplayValue,
        handleTouchStart,
        handleTouchEnd,
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
                            onTouchStart={timer.handleTouchStart}
                            onTouchEnd={timer.handleTouchEnd}
                            onContextMenu={(e) => e.preventDefault()}
                        >
                            {timer.getDisplayValue()}
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