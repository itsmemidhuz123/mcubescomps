'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TimerProvider, useTimer } from '@/contexts/TimerContext';
import { useSyncManager } from '@/hooks/useSyncManager';
import { useCubingScramble } from '@/hooks/useCubingScramble';
import TimerWidget from '@/app/timer/components/TimerWidget';
import ScrambleCard from '@/app/timer/components/ScrambleCard';
import SolveList from '@/app/timer/components/SolveList';
import StatsPanel from '@/app/timer/components/StatsPanel';
import ScrambleImageModal from '@/app/timer/components/ScrambleImageModal';
import MergeDialog from '@/app/timer/components/MergeDialog';
import FloatingScrambleImage from '@/app/timer/components/FloatingScrambleImage';
import SessionHistoryModal from '@/app/timer/components/SessionHistoryModal';
import NewSessionDialog from '@/app/timer/components/NewSessionDialog';
import { Button } from '@/components/ui/button';
import { BarChart3, Eye, EyeOff, Maximize2, Minimize2, X, Edit3 } from 'lucide-react';

const TIMER_STATES = {
    IDLE: 'idle',
    ARMED: 'armed',
    INSPECTION: 'inspection',
    INSPECTION_ARMED: 'inspection_armed',
    RUNNING: 'running',
    STOPPED: 'stopped'
};

const SCRAMBLE_STORAGE_KEY = 'timer_current_scramble';
const SCRAMBLE_EVENT_KEY = 'timer_current_event';
const VISUALIZATION_KEY = 'timer_visualization';

function TimerEngine({ onSolveComplete, generateScramble, initialScramble }) {
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

        // Never show negative numbers
        const displaySecs = Math.max(0, remainingSecs);
        setInspectionRemaining(displaySecs);

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

        // At exactly 0, if user is NOT holding, auto-start timer with no penalty
        if (remainingSecs <= 0 && timerStateRef.current === TIMER_STATES.INSPECTION) {
            startTimer('none');
            return;
        }

        // If user is holding (INSPECTION_ARMED):
        // - 15-17s elapsed: release will give +2
        // - 17s+ elapsed: auto-DNF and start timer
        if (elapsedSecs > 17 && timerStateRef.current === TIMER_STATES.INSPECTION_ARMED) {
            startTimer('DNF');
            return;
        }

        // Continue loop if still in inspection or inspection_armed state
        if (timerStateRef.current === TIMER_STATES.INSPECTION ||
            timerStateRef.current === TIMER_STATES.INSPECTION_ARMED) {
            inspectionRafIdRef.current = requestAnimationFrame(updateInspection);
        }
    }, [playBeep, startTimer]);

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

    const releaseFromArmed = useCallback(() => {
        const currentState = timerStateRef.current;

        if (currentState === TIMER_STATES.ARMED) {
            if (settings.inspectionEnabled) {
                startInspection();
            } else {
                startTimer('none');
            }
        } else if (currentState === TIMER_STATES.INSPECTION_ARMED) {
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
                    armTimer();
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
    const { solves, stats, event, deleteSolve, updateSolvePenalty, currentSession, sessions, switchEvent, createSession, refreshSession } = useTimer();
    const eventId = event?.id || '333';
    const { scramble, isLoading, generateScramble } = useCubingScramble(eventId);
    const { syncStatus, showMergePrompt, setShowMergePrompt, syncAllSessions, mergeData } = useSyncManager();

    const [showStats, setShowStats] = useState(false);
    const [currentSolve, setCurrentSolve] = useState(null);
    const [showScrambleImage, setShowScrambleImage] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [showSessionHistory, setShowSessionHistory] = useState(false);
    const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
    const [scrambleVisualization, setScrambleVisualization] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(VISUALIZATION_KEY) || '2d';
        }
        return '2d';
    });

    const timer = TimerEngine({
        onSolveComplete: handleSolveComplete,
        generateScramble: () => {
            generateScramble();
            saveScrambleToStorage(scramble, eventId);
        }
    });

    function handleSolveComplete(solve) {
        setCurrentSolve(solve.time);
    }

    // Scramble persistence
    const saveScrambleToStorage = useCallback((scrambleStr, event) => {
        try {
            localStorage.setItem(SCRAMBLE_STORAGE_KEY, scrambleStr || '');
            localStorage.setItem(SCRAMBLE_EVENT_KEY, event || '333');
        } catch (e) { }
    }, []);

    // Save visualization preference
    const saveVisualizationPreference = useCallback((viz) => {
        try {
            localStorage.setItem(VISUALIZATION_KEY, viz);
        } catch (e) { }
    }, []);

    const loadScrambleFromStorage = useCallback(() => {
        try {
            const storedEvent = localStorage.getItem(SCRAMBLE_EVENT_KEY);
            const storedScramble = localStorage.getItem(SCRAMBLE_STORAGE_KEY);
            return { event: storedEvent, scramble: storedScramble };
        } catch (e) {
            return { event: null, scramble: null };
        }
    }, []);

    // Fullscreen handlers
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

    // ESC key handler for exiting fullscreen
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Hide footer in focus mode
    useEffect(() => {
        const footer = document.querySelector('footer');
        if (footer) {
            footer.style.display = isFocusMode || isFullscreen ? 'none' : '';
        }
        return () => {
            if (footer) {
                footer.style.display = '';
            }
        };
    }, [isFocusMode, isFullscreen]);

    // Load saved scramble on mount
    useEffect(() => {
        const { event: storedEvent, scramble: storedScramble } = loadScrambleFromStorage();
        if (storedScramble && storedEvent === eventId) {
            // Scramble already loaded via hook
        }
    }, [eventId, loadScrambleFromStorage]);

    // Save scramble when it changes
    useEffect(() => {
        if (scramble) {
            saveScrambleToStorage(scramble, eventId);
        }
    }, [scramble, eventId, saveScrambleToStorage]);

    // Handle event switch
    const handleEventSwitch = useCallback(async (newEventId) => {
        await switchEvent(newEventId);
    }, [switchEvent]);

    // New session handlers
    const handleNewSession = useCallback(() => {
        if (solves && solves.length > 0) {
            setShowNewSessionDialog(true);
        } else {
            handleConfirmNewSession();
        }
    }, [solves]);

    const handleConfirmNewSession = useCallback(async () => {
        setShowNewSessionDialog(false);
        await createSession();
        generateScramble();
    }, [createSession, generateScramble]);

    const handleLoadSession = useCallback(async (session) => {
        setShowSessionHistory(false);
        // Switch to the session's event if different
        if (session.eventId !== eventId) {
            await handleEventSwitch(session.eventId);
        }
        // The session will be loaded automatically
        refreshSession();
    }, [eventId, handleEventSwitch, refreshSession]);

    const handleDeleteSession = useCallback(async (sessionId) => {
        // TODO: Implement delete from IndexedDB
        console.log('Delete session:', sessionId);
    }, []);

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
        <div className={`min-h-screen bg-[#0f1117] ${isFullscreen ? 'fixed inset-0 z-[9999]' : ''}`}>
            <TimerWidget
                syncStatus={syncStatus}
                onSync={syncAllSessions}
                isFullscreen={isFullscreen}
                onToggleFullscreen={toggleFullscreen}
                isFocusMode={isFocusMode}
                onToggleFocusMode={toggleFocusMode}
                sessionName={currentSession?.name || `Session ${currentSession?.createdAt ? new Date(currentSession.createdAt).toLocaleDateString() : '1'}`}
                onNewSession={handleNewSession}
                onViewHistory={() => setShowSessionHistory(true)}
            />

            <main className={`${isFullscreen ? 'pt-0' : 'pt-28'} pb-8 px-4 transition-all duration-300`}>
                <div className="max-w-2xl mx-auto space-y-4">
                    <div className="relative">
                        {!isFocusMode && (
                            <ScrambleCard
                                scramble={scramble}
                                onRefresh={generateScramble}
                                onShowImage={() => setShowScrambleImage(true)}
                                eventId={eventId}
                                isLoading={isLoading}
                                scrambleVisualization={scrambleVisualization}
                                onScrambleVisualizationChange={(viz) => {
                                    setScrambleVisualization(viz);
                                    saveVisualizationPreference(viz);
                                }}
                            />
                        )}

                        {/* Focus mode: show scramble text instead of card */}
                        {isFocusMode && scramble && (
                            <div className="text-center mb-4">
                                <p className="font-mono text-sm text-zinc-500">{scramble}</p>
                            </div>
                        )}
                    </div>

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

                    {!isFocusMode && (
                        <>
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
                        </>
                    )}
                </div>
            </main>

            <StatsPanel isOpen={showStats} onClose={() => setShowStats(false)} stats={stats} currentSolve={currentSolve} />
            <ScrambleImageModal isOpen={showScrambleImage} onClose={() => setShowScrambleImage(false)} scramble={scramble} eventId={eventId} />
            <MergeDialog isOpen={showMergePrompt} onClose={() => setShowMergePrompt(false)} onMerge={handleMerge} onKeepLocal={handleKeepLocal} onDiscard={handleDiscard} localSessionCount={0} />
            <SessionHistoryModal
                isOpen={showSessionHistory}
                onClose={() => setShowSessionHistory(false)}
                sessions={sessions}
                onLoadSession={handleLoadSession}
                onDeleteSession={handleDeleteSession}
                currentSessionId={currentSession?.sessionId}
            />
            <NewSessionDialog
                isOpen={showNewSessionDialog}
                onClose={() => setShowNewSessionDialog(false)}
                onConfirm={handleConfirmNewSession}
                onCancel={() => setShowNewSessionDialog(false)}
                sessionName={currentSession?.name || 'Current Session'}
            />

            {/* Focus Mode Exit Button */}
            {isFocusMode && (
                <button
                    onClick={toggleFocusMode}
                    className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full bg-[#161a23] border border-[#2a2f3a] flex items-center justify-center text-zinc-400 hover:text-white hover:border-[#3a3f4a] transition-colors"
                    title="Exit Focus Mode"
                >
                    <X className="w-5 h-5" />
                </button>
            )}

            {/* Floating Scramble Image - Bottom Right */}
            {scramble && (
                <div className={`fixed z-40 ${isFullscreen ? 'bottom-8 right-8' : 'bottom-6 right-6'}`}>
                    <FloatingScrambleImage
                        scramble={scramble}
                        eventId={eventId}
                        onClick={() => setShowScrambleImage(true)}
                        visualization={scrambleVisualization}
                    />
                </div>
            )}
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