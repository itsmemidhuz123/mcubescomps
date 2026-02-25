'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useTimerEngine, TIMER_STATES } from '@/hooks/useTimerEngine';
import { useTimer } from '@/contexts/TimerContext';
import { Plus, X } from 'lucide-react';

const HOLD_THRESHOLD = 200;

export default function TimerDisplay({ onTimerStop, onGenerateScramble }) {
    const { addSolve, settings } = useTimer();

    const [pendingSolve, setPendingSolve] = useState(null);
    const [showPenaltyButtons, setShowPenaltyButtons] = useState(false);

    const holdTimerRef = useRef(null);
    const isHoldingRef = useRef(false);
    const holdStartTimeRef = useRef(null);

    const handleTimerStop = useCallback((solve, isPenaltyUpdate = false) => {
        if (isPenaltyUpdate) return;
        setPendingSolve(solve);
        setShowPenaltyButtons(true);
    }, []);

    const {
        timerState,
        displayTime,
        inspectionRemaining,
        inspectionPenalty,
        formatTime,
        formatInspectionTime,
        startTimer,
        stopTimer,
        startInspection,
        resetTimer
    } = useTimerEngine({
        inspectionEnabled: settings.inspectionEnabled,
        onTimerStop: handleTimerStop
    });

    const handleConfirmSolve = useCallback(async (penalty = 'none') => {
        if (!pendingSolve) return;

        const finalSolve = { ...pendingSolve, penalty };
        await addSolve(finalSolve);

        setPendingSolve(null);
        setShowPenaltyButtons(false);
        resetTimer();

        if (onTimerStop) onTimerStop(finalSolve);
        if (onGenerateScramble) onGenerateScramble();
    }, [pendingSolve, addSolve, onTimerStop, onGenerateScramble, resetTimer]);

    // Auto-confirm DNF solves from inspection
    useEffect(() => {
        if (pendingSolve && pendingSolve.penalty === 'DNF' && showPenaltyButtons) {
            handleConfirmSolve('DNF');
        }
    }, [pendingSolve, showPenaltyButtons, handleConfirmSolve]);

    const doInspectionStart = useCallback(() => {
        if (settings.inspectionEnabled) {
            startInspection();
        } else {
            startTimer();
        }
    }, [settings.inspectionEnabled, startInspection, startTimer]);

    const handleTap = useCallback(() => {
        if (timerState === TIMER_STATES.RUNNING) {
            stopTimer();
        } else if (timerState === TIMER_STATES.STOPPED) {
            handleConfirmSolve('none');
        }
    }, [timerState, stopTimer, handleConfirmSolve]);

    const handleHoldStart = useCallback(() => {
        isHoldingRef.current = true;
        holdStartTimeRef.current = Date.now();

        holdTimerRef.current = setTimeout(() => {
            if (isHoldingRef.current && timerState === TIMER_STATES.IDLE) {
                doInspectionStart();
            }
        }, HOLD_THRESHOLD);
    }, [timerState, doInspectionStart]);

    const handleHoldEnd = useCallback(() => {
        const holdDuration = Date.now() - (holdStartTimeRef.current || 0);
        isHoldingRef.current = false;

        if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }

        // Only start timer if we were already in inspection (not a short tap from idle)
        if (timerState === TIMER_STATES.INSPECTION && holdDuration >= HOLD_THRESHOLD) {
            startTimer();
        }
    }, [timerState, startTimer]);

    const handleKeyDown = useCallback((e) => {
        if (e.code !== 'Space') return;
        e.preventDefault();
        e.stopPropagation();

        if (timerState === TIMER_STATES.RUNNING) {
            stopTimer();
        } else if (!e.repeat) {
            handleHoldStart();
        }
    }, [timerState, stopTimer, handleHoldStart]);

    const handleKeyUp = useCallback((e) => {
        if (e.code !== 'Space') return;
        e.preventDefault();
        e.stopPropagation();

        if (timerState === TIMER_STATES.INSPECTION) {
            handleHoldEnd();
        }
    }, [timerState, handleHoldEnd]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown, { passive: false });
        window.addEventListener('keyup', handleKeyUp, { passive: false });
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleKeyDown, handleKeyUp]);

    const handleTouchStart = (e) => {
        e.preventDefault();
        if (timerState === TIMER_STATES.RUNNING) {
            stopTimer();
        } else {
            handleHoldStart();
        }
    };

    const handleTouchEnd = (e) => {
        e.preventDefault();
        if (timerState === TIMER_STATES.INSPECTION) {
            handleHoldEnd();
        }
    };

    const getTimerColor = () => {
        if (timerState === TIMER_STATES.INSPECTION) {
            if (inspectionRemaining <= 3) return 'text-red-500';
            if (inspectionRemaining <= 8) return 'text-yellow-500';
            return 'text-yellow-400';
        }
        if (timerState === TIMER_STATES.RUNNING) return 'text-white';
        return 'text-white';
    };

    const getGlowClass = () => {
        if (settings.disableGlow) return '';
        if (timerState === TIMER_STATES.INSPECTION) return 'drop-shadow-[0_0_15px_rgba(34,197,94,0.6)]';
        if (timerState === TIMER_STATES.RUNNING) return 'drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]';
        return '';
    };

    const getStatusText = () => {
        if (timerState === TIMER_STATES.RUNNING) {
            if (inspectionPenalty && inspectionPenalty !== 'none') {
                return `Tap to stop (+${inspectionPenalty === '+2' ? '2' : 'DNF'})`;
            }
            return 'Tap to stop';
        }
        if (timerState === TIMER_STATES.INSPECTION) {
            if (inspectionPenalty === 'DNF') return 'DNF - Inspection exceeded';
            if (inspectionPenalty === '+2') return 'Release to start (+2)';
            return 'Release to start timer';
        }
        if (timerState === TIMER_STATES.STOPPED && showPenaltyButtons) return 'Apply penalty or confirm';
        if (timerState === TIMER_STATES.STOPPED) return 'Tap for next solve';
        return 'Hold to start inspection';
    };

    return (
        <div className="flex flex-col items-center">
            <div
                className={`relative cursor-pointer select-none`}
                onMouseDown={handleTouchStart}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <div className={`text-7xl md:text-8xl font-mono font-bold transition-colors ${getTimerColor()} ${getGlowClass()}`}>
                    {timerState === TIMER_STATES.INSPECTION
                        ? formatInspectionTime(inspectionRemaining)
                        : timerState === TIMER_STATES.STOPPED && inspectionPenalty === 'DNF'
                            ? 'DNF'
                            : formatTime(displayTime)
                    }
                </div>
            </div>

            <p className="text-zinc-400 mt-4 mb-6 text-center">
                {getStatusText()}
            </p>

            {showPenaltyButtons && pendingSolve && (
                <div className="flex gap-3 mb-4">
                    <Button
                        variant="outline"
                        onClick={() => handleConfirmSolve('+2')}
                        className="border-orange-500/50 text-orange-400 hover:bg-orange-500/20"
                    >
                        <Plus className="w-4 h-4 mr-1" />+2
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => handleConfirmSolve('DNF')}
                        className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                    >
                        <X className="w-4 h-4 mr-1" />DNF
                    </Button>
                    <Button
                        variant="default"
                        onClick={() => handleConfirmSolve('none')}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        Confirm
                    </Button>
                </div>
            )}
        </div>
    );
}
