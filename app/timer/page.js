'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TimerProvider, useTimer } from '@/contexts/TimerContext';
import { useSyncManager } from '@/hooks/useSyncManager';
import { useCubingScramble } from '@/hooks/useCubingScramble';
import { WCA_EVENTS } from '@/lib/events';
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
import SolveDrawer from '@/app/timer/components/SolveDrawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BarChart3, Eye, EyeOff, Maximize2, Minimize2, X, Edit3, Settings } from 'lucide-react';
import Link from 'next/link';

function StatBox({ label, value, highlight = 'blue', className = '' }) {
    const colors = {
        green: 'bg-green-500/20 border-green-500/30 text-green-400',
        blue: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
        red: 'bg-red-500/20 border-red-500/30 text-red-400',
        purple: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
        orange: 'bg-orange-500/20 border-orange-500/30 text-orange-400',
    };

    return (
        <div className={`p-3 rounded-lg border ${colors[highlight]} ${className}`}>
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
            <div className="font-mono font-semibold text-lg">{value}</div>
        </div>
    );
}

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

function TimerEngine({ onSolveComplete, generateScramble, initialScramble, settings }) {
    const { addSolve } = useTimer();
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
    const audioContextRef = useRef(null);
    const inspectionZeroTimeRef = useRef(null);
    const inspectionActiveRef = useRef(false);
    const pressStartRef = useRef(null);

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
        if (!settings.enableSounds) return;
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
        } catch (e) { }
    }, [getAudioContext, settings.enableSounds]);

    const formatTime = useCallback((ms) => {
        if (ms < 0) return '0.00';
        const seconds = Math.floor(ms / 1000);
        const centiseconds = Math.floor((ms % 1000) / 10);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;

        const decimal = settings.decimalPoints === 3
            ? centiseconds.toString().padStart(3, '0').slice(0, 3)
            : centiseconds.toString().padStart(2, '0').slice(0, 2);

        if (minutes > 0) {
            return `${minutes}:${secs.toString().padStart(2, '0')}.${decimal}`;
        }
        return `${secs}.${decimal}`;
    }, [settings.decimalPoints]);

    const startTimer = useCallback((penalty = 'none') => {
        if (inspectionRafIdRef.current) {
            cancelAnimationFrame(inspectionRafIdRef.current);
            inspectionRafIdRef.current = null;
        }
        inspectionActiveRef.current = false;
        setInspectionPenalty(penalty);
        setTimerState(TIMER_STATES.RUNNING);
        setInspectionRemaining(15);
        startTimeRef.current = performance.now();
        inspectionStartRef.current = null;
        inspectionZeroTimeRef.current = null;

        // Auto fullscreen if enabled
        if (settings.fullscreenOnStart && !document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
        }

        const updateDisplay = () => {
            if (startTimeRef.current !== null) {
                const elapsed = performance.now() - startTimeRef.current;
                setDisplayTime(elapsed);
                rafIdRef.current = requestAnimationFrame(updateDisplay);
            }
        };
        rafIdRef.current = requestAnimationFrame(updateDisplay);
    }, [settings.fullscreenOnStart]);

    const stopTimer = useCallback(() => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        const finalTime = startTimeRef.current !== null ? performance.now() - startTimeRef.current : 0;
        startTimeRef.current = null;
        setTimerState(TIMER_STATES.STOPPED);
        setDisplayTime(finalTime);
        const solve = { time: finalTime, penalty: inspectionPenalty, createdAt: Date.now() };
        setPendingSolve(solve);
        setShowPenaltyButtons(true);
    }, [inspectionPenalty]);

    const startInspection = useCallback(() => {
        inspectionActiveRef.current = true;
        setTimerState(TIMER_STATES.INSPECTION);
        setInspectionRemaining(15);
        setInspectionPenalty('none');
        lastBeepRef.current = 15;
        inspectionStartRef.current = performance.now();
        inspectionZeroTimeRef.current = null;

        const updateInspection = () => {
            if (!inspectionActiveRef.current || inspectionStartRef.current === null) return;

            const elapsed = performance.now() - inspectionStartRef.current;
            const elapsedSecs = elapsed / 1000;
            const remaining = Math.max(0, 15 - elapsedSecs);
            const remainingSecs = Math.ceil(remaining);

            if (remainingSecs <= 0 && inspectionZeroTimeRef.current === null) {
                inspectionZeroTimeRef.current = performance.now();
            }

            const timeAfterZero = inspectionZeroTimeRef.current ? (performance.now() - inspectionZeroTimeRef.current) / 1000 : 0;

            let displaySecs;
            if (remainingSecs > 0) {
                displaySecs = remainingSecs;
            } else {
                displaySecs = -Math.ceil(timeAfterZero);
            }
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

            if (timeAfterZero > 2) {
                // Auto DNF
                const solve = { time: 0, penalty: 'DNF', createdAt: Date.now() };
                addSolve(solve);
                inspectionActiveRef.current = false;
                inspectionStartRef.current = null;
                inspectionZeroTimeRef.current = null;
                setTimerState(TIMER_STATES.IDLE);
                setInspectionRemaining(15);
                setInspectionPenalty('none');
                generateScramble();
                if (onSolveComplete) onSolveComplete(solve);
                return;
            }

            if (inspectionActiveRef.current) {
                inspectionRafIdRef.current = requestAnimationFrame(updateInspection);
            }
        };
        inspectionRafIdRef.current = requestAnimationFrame(updateInspection);
    }, [playBeep, addSolve, generateScramble, onSolveComplete]);

    const confirmSolve = useCallback(async (penalty = 'none') => {
        if (!pendingSolve) return;
        const finalPenalty = inspectionPenalty !== 'none' ? inspectionPenalty : penalty;
        const finalSolve = { ...pendingSolve, penalty: finalPenalty };

        // Auto confirm if enabled
        if (settings.autoConfirmSolve) {
            await addSolve(finalSolve);
            setPendingSolve(null);
            setShowPenaltyButtons(false);
            setInspectionPenalty('none');
            setTimerState(TIMER_STATES.IDLE);
            setDisplayTime(0);
            setInspectionRemaining(15);
            inspectionStartRef.current = null;
            inspectionActiveRef.current = false;
            generateScramble();
            if (onSolveComplete) onSolveComplete(finalSolve);
        } else {
            await addSolve(finalSolve);
            setPendingSolve(null);
            setShowPenaltyButtons(false);
            setInspectionPenalty('none');
            setTimerState(TIMER_STATES.IDLE);
            setDisplayTime(0);
            setInspectionRemaining(15);
            inspectionStartRef.current = null;
            inspectionActiveRef.current = false;
            generateScramble();
            if (onSolveComplete) onSolveComplete(finalSolve);
        }
    }, [pendingSolve, addSolve, generateScramble, onSolveComplete, inspectionPenalty, settings.autoConfirmSolve]);

    // Event handlers using refs for state
    const handlePress = useCallback((action) => {
        const currentState = timerState;
        const freezeTimeMs = settings.freezeTime * 1000;

        if (action === 'start') {
            // Press/hold
            if (currentState === TIMER_STATES.IDLE || currentState === TIMER_STATES.STOPPED) {
                setTimerState(TIMER_STATES.ARMED);
                pressStartRef.current = performance.now();
            } else if (currentState === TIMER_STATES.INSPECTION) {
                setTimerState(TIMER_STATES.INSPECTION_ARMED);
            } else if (currentState === TIMER_STATES.RUNNING) {
                stopTimer();
            }
        } else if (action === 'end') {
            // Release
            if (currentState === TIMER_STATES.ARMED) {
                const holdTime = pressStartRef.current ? performance.now() - pressStartRef.current : 0;
                if (holdTime < freezeTimeMs) {
                    // Too short - cancel
                    setTimerState(TIMER_STATES.IDLE);
                    pressStartRef.current = null;
                    return;
                }
                if (settings.inspectionEnabled) {
                    startInspection();
                } else {
                    startTimer('none');
                }
            } else if (currentState === TIMER_STATES.INSPECTION_ARMED) {
                const elapsed = inspectionStartRef.current ? performance.now() - inspectionStartRef.current : 0;
                const elapsedSecs = elapsed / 1000;
                let penalty = 'none';
                if (elapsedSecs > 17) penalty = 'DNF';
                else if (elapsedSecs > 15) penalty = '+2';
                startTimer(penalty);
            } else if (currentState === TIMER_STATES.INSPECTION) {
                if (inspectionZeroTimeRef.current) {
                    const timeAfterZero = (performance.now() - inspectionZeroTimeRef.current) / 1000;
                    if (timeAfterZero <= 2) {
                        startTimer('+2');
                    }
                } else {
                    startTimer('none');
                }
            }
        }
    }, [timerState, settings.inspectionEnabled, settings.freezeTime, startInspection, startTimer, stopTimer]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                e.stopPropagation();
                handlePress('start');
            }
        };
        const handleKeyUp = (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                e.stopPropagation();
                handlePress('end');
            }
        };

        // Add event listeners with capture phase to prevent scrolling before other handlers
        window.addEventListener('keydown', handleKeyDown, { capture: true });
        window.addEventListener('keyup', handleKeyUp, { capture: true });
        return () => {
            window.removeEventListener('keydown', handleKeyDown, { capture: true });
            window.removeEventListener('keyup', handleKeyUp, { capture: true });
        };
    }, [handlePress]);

    const handleTouchStart = useCallback((e) => {
        e.preventDefault();
        handlePress('start');
    }, [handlePress]);

    const handleTouchEnd = useCallback((e) => {
        e.preventDefault();
        handlePress('end');
    }, [handlePress]);

    const getTimerColor = useCallback(() => {
        if (timerState === TIMER_STATES.ARMED || timerState === TIMER_STATES.INSPECTION_ARMED) {
            return 'text-green-500';
        }
        if (timerState === TIMER_STATES.RUNNING) return 'text-white';
        if (timerState === TIMER_STATES.INSPECTION) {
            if (inspectionRemaining <= -2) return 'text-red-500 animate-pulse';
            if (inspectionRemaining <= 0) return 'text-red-500';
            if (inspectionRemaining <= 3) return 'text-red-500';
            if (inspectionRemaining <= 8) return 'text-yellow-500';
            return 'text-yellow-400';
        }
        return 'text-white';
    }, [timerState, inspectionRemaining]);

    const getStatusText = useCallback(() => {
        if (timerState === TIMER_STATES.RUNNING) return 'Press SPACE or tap to stop';
        if (timerState === TIMER_STATES.INSPECTION) return 'Hold to start';
        if (timerState === TIMER_STATES.INSPECTION_ARMED) return 'Release to start';
        if (timerState === TIMER_STATES.ARMED) return 'Release to start';
        if (timerState === TIMER_STATES.STOPPED && showPenaltyButtons) return 'Apply penalty or confirm';
        return 'Hold SPACE or tap to start';
    }, [timerState, showPenaltyButtons]);

    const getDisplayValue = useCallback(() => {
        if (timerState === TIMER_STATES.INSPECTION || timerState === TIMER_STATES.INSPECTION_ARMED) {
            return inspectionRemaining;
        }
        return formatTime(displayTime);
    }, [timerState, inspectionRemaining, displayTime, formatTime]);

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
    const { solves, stats, event, deleteSolve, updateSolvePenalty, currentSession, sessions, switchEvent, createSession, refreshSession, settings, isLoading: isSettingsLoading } = useTimer();
    const eventId = event?.id || '333';
    const { scramble, isLoading, generateScramble } = useCubingScramble(eventId);
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
    const [showEventSelector, setShowEventSelector] = useState(false);
    const [scrambleVisualization, setScrambleVisualization] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(VISUALIZATION_KEY) || '2d';
        }
        return '2d';
    });

    // Initialize focus mode from settings
    useEffect(() => {
        if (!isSettingsLoading && settings.focusModeDefault) {
            setIsFocusMode(true);
        }
    }, [isSettingsLoading, settings.focusModeDefault]);

    // Get local setting values for render
    const showScrambleImage = settings.showScrambleImage;
    const showSessionStatsPanel = settings.showSessionStatsPanel;
    const decimalPoints = settings.decimalPoints;
    const showLargeAverages = settings.showLargeAverages;
    const enableSounds = settings.enableSounds;
    const fullscreenOnStart = settings.fullscreenOnStart;
    const defaultScrambleVisualization = settings.defaultScrambleVisualization || '2d';

    // Use setting for default, but allow user toggle
    const [scrambleVisualization, setScrambleVisualization] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(VISUALIZATION_KEY) || defaultScrambleVisualization;
        }
        return defaultScrambleVisualization;
    });

    // Force 2D for events that have issues with 3D (sq1, clock)
    const safeVisualization = (eventId === 'sq1' || eventId === 'clock') ? '2d' : scrambleVisualization;

    const timer = TimerEngine({
        onSolveComplete: handleSolveComplete,
        generateScramble: () => {
            generateScramble();
            saveScrambleToStorage(scramble, eventId);
        },
        settings
    });

    function handleSolveComplete(solve) {
        setCurrentSolve(solve.time);

        // Check for PB if animation is enabled
        if (settings.enablePBAnimation && solve.penalty !== 'DNF') {
            const finalTime = solve.penalty === '+2' ? solve.time + 2000 : solve.time;
            const currentBest = stats.bestTime;
            if (!currentBest || finalTime < currentBest) {
                setShowPBAnimation(true);
                setTimeout(() => setShowPBAnimation(false), 3000);
            }
        }
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

    // Prevent page scroll when using spacebar for timer
    useEffect(() => {
        const preventScroll = (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        document.addEventListener('keydown', preventScroll, { passive: false });
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', preventScroll);
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, []);

    return (
        <div className={`timer-page min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-black overflow-x-hidden ${isFullscreen ? 'fixed inset-0 z-[9999] overflow-hidden' : ''}`}>
            {/* Background gradient effect */}
            {!isFullscreen && (
                <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent pointer-events-none" />
            )}

            {/* Header - Clean like CubeDesk */}
            {!isFullscreen && (
                <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/50">
                    <div className="container mx-auto px-4 h-14 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
                                <span className="text-white font-bold text-sm">M</span>
                            </div>
                            <span className="font-semibold text-white">Timer</span>
                        </div>
                        <div className="flex items-center gap-2">
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
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-zinc-400 hover:text-white"
                                >
                                    <Settings className="w-4 h-4" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </header>
            )}

            {/* Fullscreen header */}
            {isFullscreen && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleFullscreen}
                        className="bg-zinc-900/80 backdrop-blur text-zinc-400 hover:text-white border border-zinc-700"
                    >
                        <Minimize2 className="w-4 h-4 mr-1" /> Exit
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleFocusMode}
                        className="bg-zinc-900/80 backdrop-blur text-zinc-400 hover:text-white border border-zinc-700"
                    >
                        <EyeOff className="w-4 h-4 mr-1" /> Focus
                    </Button>
                    <Link href="/timer/settings">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="bg-zinc-900/80 backdrop-blur text-zinc-400 hover:text-white border border-zinc-700"
                        >
                            <Settings className="w-4 h-4 mr-1" /> Settings
                        </Button>
                    </Link>
                </div>
            )}

            <main className={`${isFullscreen ? 'pt-16' : 'pt-4'} pb-24 px-4 transition-all duration-300`}>
                {/* Desktop Layout - 3 Column */}
                <div className="max-w-7xl mx-auto hidden lg:block">
                    <div className={`grid gap-6 ${showSessionStatsPanel ? 'grid-cols-12' : 'grid-cols-1 max-w-2xl mx-auto'}`}>
                        {/* Left Column - Solve List */}
                        <div className={showSessionStatsPanel ? 'col-span-4' : 'col-span-1'}>
                            <SolveList
                                solves={solves}
                                stats={stats}
                                bestSingle={bestSingle}
                                onDeleteSolve={deleteSolve}
                                onUpdatePenalty={updateSolvePenalty}
                            />
                        </div>

                        {/* Center Column - Timer & Scramble */}
                        <div className={showSessionStatsPanel ? 'col-span-5' : 'col-span-1'}>
                            <div className="flex flex-col items-center justify-center min-h-[70vh]">
                                {/* Scramble Card - Glass Effect */}
                                <div className="w-full mb-8">
                                    {!isFocusMode && showScrambleImage && (
                                        <ScrambleCard
                                            scramble={scramble}
                                            onRefresh={generateScramble}
                                            onShowImage={() => setShowScrambleImageModal(true)}
                                            eventId={eventId}
                                            isLoading={isLoading}
                                            scrambleVisualization={safeVisualization}
                                            onScrambleVisualizationChange={(viz) => {
                                                setScrambleVisualization(viz);
                                                saveVisualizationPreference(viz);
                                            }}
                                        />
                                    )}
                                    {/* Focus mode scramble text */}
                                    {isFocusMode && scramble && (
                                        <div className="text-center mb-4">
                                            <p className="font-mono text-sm text-zinc-500 bg-zinc-900/50 py-2 px-4 rounded-lg inline-block">{scramble}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Timer Display */}
                                <div className="text-center py-8">
                                    <div
                                        className={`text-9xl md:text-[10rem] font-mono font-bold tracking-tight transition-colors cursor-pointer select-none outline-none ${timer.getTimerColor()} ${timer.timerState === 'armed' || timer.timerState === 'inspection_armed' ? 'drop-shadow-lg' : ''} ${showPBAnimation ? 'text-green-400 drop-shadow-[0_0_30px_rgba(74,222,128,0.8)] animate-pulse' : ''}`}
                                        onTouchStart={timer.handleTouchStart}
                                        onTouchEnd={timer.handleTouchEnd}
                                        onContextMenu={(e) => e.preventDefault()}
                                    >
                                        {timer.getDisplayValue()}
                                    </div>
                                    <p className="text-zinc-500 mt-4 mb-6">{timer.getStatusText()}</p>

                                    {/* Penalty Buttons */}
                                    {timer.showPenaltyButtons && timer.pendingSolve && (
                                        <div className="flex gap-3 justify-center animate-in fade-in slide-in-from-bottom-2">
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
                            </div>
                        </div>

                        {/* Right Column - Stats Panel (Inline) */}
                        {showSessionStatsPanel && (
                            <div className="col-span-3">
                                <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800/50 rounded-xl p-4 space-y-4">
                                    <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Statistics</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <StatBox label="Best" value={stats.bestTime ? timer.formatTime(stats.bestTime) : '-'} highlight="green" />
                                        <StatBox label="Average" value={stats.average ? timer.formatTime(stats.average) : '-'} highlight="blue" />
                                        <StatBox label="Worst" value={stats.worstTime ? timer.formatTime(stats.worstTime) : '-'} highlight="red" />
                                        <StatBox label="Ao5" value={stats.ao5 ? timer.formatTime(stats.ao5) : '-'} highlight="purple" />
                                        <StatBox label="Ao12" value={stats.ao12 ? timer.formatTime(stats.ao12) : '-'} highlight="orange" className="col-span-2" />
                                        {showLargeAverages && (
                                            <>
                                                <StatBox label="Ao50" value={stats.ao50 ? timer.formatTime(stats.ao50) : '-'} highlight="blue" className="col-span-2" />
                                                <StatBox label="Ao100" value={stats.ao100 ? timer.formatTime(stats.ao100) : '-'} highlight="purple" className="col-span-2" />
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mobile/Tablet Layout - Vertical Stack */}
                <div className="lg:hidden">
                    {/* Event & Session Info */}
                    {!isFocusMode && (
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-sm text-zinc-400">
                                {currentSession?.name || `Session ${(() => {
                                    const d = new Date();
                                    const day = String(d.getDate()).padStart(2, '0');
                                    const month = String(d.getMonth() + 1).padStart(2, '0');
                                    const year = d.getFullYear();
                                    return `${day}/${month}/${year}`;
                                })()}`}
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setShowStats(true)} className="text-zinc-400">
                                <BarChart3 className="w-4 h-4" />
                            </Button>
                        </div>
                    )}

                    {/* Scramble Card */}
                    <div className="mb-6 flex items-center justify-between md:justify-start gap-2 md:gap-4">
                        <span className="text-xs text-zinc-400 md:hidden">Solves</span>
                        <button className="px-3 py-1 rounded bg-zinc-800 text-white text-xs md:hidden" onClick={() => setShowSolvesDrawer(true)}>View All Solves</button>
                    </div>
                    <div className="mb-6">
                        {!isFocusMode && showScrambleImage && (
                            <ScrambleCard
                                scramble={scramble}
                                onRefresh={generateScramble}
                                onShowImage={() => setShowScrambleImageModal(true)}
                                eventId={eventId}
                                isLoading={isLoading}
                                scrambleVisualization={safeVisualization}
                                onScrambleVisualizationChange={(viz) => {
                                    setScrambleVisualization(viz);
                                    saveVisualizationPreference(viz);
                                }}
                            />
                        )}
                        {isFocusMode && scramble && (
                            <div className="text-center mb-4">
                                <p className="font-mono text-sm text-zinc-500 bg-zinc-900/50 py-2 px-4 rounded-lg inline-block">{scramble}</p>
                            </div>
                        )}
                    </div>

                    {/* Timer */}
                    <div className="text-center py-6">
                        <div
                            className={`text-7xl md:text-8xl font-mono font-bold tracking-tight transition-colors cursor-pointer select-none outline-none ${timer.getTimerColor()} ${showPBAnimation ? 'text-green-400 drop-shadow-[0_0_30px_rgba(74,222,128,0.8)] animate-pulse' : ''}`}
                            onTouchStart={timer.handleTouchStart}
                            onTouchEnd={timer.handleTouchEnd}
                            onContextMenu={(e) => e.preventDefault()}
                        >
                            {timer.getDisplayValue()}
                        </div>
                        <p className="text-zinc-500 mt-3 mb-4">{timer.getStatusText()}</p>

                        {timer.showPenaltyButtons && timer.pendingSolve && (
                            <div className="flex gap-2 justify-center animate-in fade-in">
                                <Button variant="outline" size="sm" onClick={() => timer.confirmSolve('+2')} className="border-orange-500/50 text-orange-400">+2</Button>
                                <Button variant="outline" size="sm" onClick={() => timer.confirmSolve('DNF')} className="border-red-500/50 text-red-400">DNF</Button>
                                <Button variant="default" size="sm" onClick={() => timer.confirmSolve('none')} className="bg-green-600">OK</Button>
                            </div>
                        )}
                    </div>

                    {/* Solve List - Collapsible on mobile */}
                    {!isFocusMode && (
                        <SolveList
                            solves={solves}
                            stats={stats}
                            bestSingle={bestSingle}
                            onDeleteSolve={deleteSolve}
                            onUpdatePenalty={updateSolvePenalty}
                        />
                    )}
                </div>
            </main>

            {/* Stats Modal */}
            <StatsPanel isOpen={showStats} onClose={() => setShowStats(false)} stats={stats} currentSolve={currentSolve} />

            {/* Scramble Image Modal */}
            {showScrambleImage && (
                <ScrambleImageModal isOpen={showScrambleImageModal} onClose={() => setShowScrambleImageModal(false)} scramble={scramble} eventId={eventId} />
            )}

            {/* Event Selector Modal */}
            <Dialog open={showEventSelector} onOpenChange={setShowEventSelector}>
                <DialogContent className="bg-[#0f1117] border-[#2a2f3a] max-w-md w-[90vw]">
                    <DialogHeader>
                        <DialogTitle className="text-white">Select Event</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-[60vh] pr-4">
                        {['cube', 'bigcube', 'special'].map(category => {
                            const categoryEvents = WCA_EVENTS.filter(e => e.category === category);
                            const categoryLabels = { cube: 'Cubes', bigcube: 'Big Cubes', special: 'Special' };
                            return (
                                <div key={category} className="mb-6">
                                    <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                                        {categoryLabels[category]}
                                    </h3>
                                    <div className="space-y-1">
                                        {categoryEvents.map(ev => (
                                            <button
                                                key={ev.id}
                                                onClick={async () => {
                                                    setShowEventSelector(false);
                                                    if (ev.id !== eventId) {
                                                        await switchEvent(ev.id);
                                                    }
                                                }}
                                                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${ev.id === eventId
                                                        ? 'bg-blue-600/20 border border-blue-600/50 text-white'
                                                        : 'bg-[#161a23] border border-[#2a2f3a] hover:bg-[#1e2330] text-zinc-300 hover:text-white'
                                                    }`}
                                            >
                                                <span className="text-xl">{ev.icon}</span>
                                                <span className="font-medium">{ev.name}</span>
                                                <span className="ml-auto text-xs text-zinc-500">{ev.fullName}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            {/* Other Modals */}
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

            {/* Floating Scramble Image - Bottom Right - Only on desktop */}
            {scramble && !isFocusMode && showScrambleImage && (
                <div className="fixed z-40 bottom-6 right-6 hidden md:block">
                    <FloatingScrambleImage
                        scramble={scramble}
                        eventId={eventId}
                        onClick={() => setShowScrambleImageModal(true)}
                        visualization={safeVisualization}
                    />
                </div>
            )}

            {/* PB Animation Overlay */}
            {showPBAnimation && (
                <div className="fixed inset-0 z-[9998] pointer-events-none">
                    <div className="absolute inset-0 bg-green-500/20 animate-pulse" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-6xl font-bold text-green-400 animate-bounce drop-shadow-[0_0_30px_rgba(74,222,128,0.8)]">
                            NEW PB!
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Solve Drawer */}
            <SolveDrawer isOpen={showSolvesDrawer} onClose={() => setShowSolvesDrawer(false)} solves={solves} onDeleteSolve={deleteSolve} onUpdatePenalty={updateSolvePenalty} />
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