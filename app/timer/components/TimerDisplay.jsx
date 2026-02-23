'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useTimerEngine, TIMER_STATES } from '@/hooks/useTimerEngine';
import { useTimer } from '@/contexts/TimerContext';
import { formatTime as formatTimeUtil } from '@/lib/timerStats';
import { Plus, Minus, X } from 'lucide-react';

export default function TimerDisplay({ onTimerStop, onGenerateScramble }) {
    const {
        solves,
        addSolve,
        updateSolvePenalty,
        settings,
        currentSession
    } = useTimer();

    const [pendingSolve, setPendingSolve] = useState(null);
    const [showPenaltyButtons, setShowPenaltyButtons] = useState(false);

    const handleTimerStop = useCallback((solve, isPenaltyUpdate = false) => {
        if (isPenaltyUpdate) {
            return;
        }
        setPendingSolve(solve);
        setShowPenaltyButtons(true);
    }, []);

    const {
        timerState,
        displayTime,
        inspectionRemaining,
        formatTime,
        startTimer,
        stopTimer,
        startInspection,
        armTimer,
        resetTimer
    } = useTimerEngine({
        inspectionEnabled: settings.inspectionEnabled,
        onTimerStop: handleTimerStop
    });

    const handleConfirmSolve = useCallback(async (penalty = 'none') => {
        if (!pendingSolve) return null;

        const finalSolve = { ...pendingSolve, penalty };
        const result = await addSolve(finalSolve);

        setPendingSolve(null);
        setShowPenaltyButtons(false);

        if (onTimerStop) {
            onTimerStop(finalSolve);
        }

        if (onGenerateScramble) {
            onGenerateScramble();
        }

        return result;
    }, [pendingSolve, addSolve, onTimerStop, onGenerateScramble]);

    const handlePenalty = async (penalty) => {
        await handleConfirmSolve(penalty);
    };

    const handleKeyDown = useCallback((e) => {
        if (e.code === 'Space' && !e.repeat) {
            e.preventDefault();

            if (timerState === TIMER_STATES.RUNNING) {
                stopTimer();
            } else if (timerState === TIMER_STATES.IDLE) {
                armTimer();
            } else if (timerState === TIMER_STATES.ARMED) {
                if (settings.inspectionEnabled) {
                    startInspection();
                } else {
                    startTimer();
                }
            }
        }
    }, [timerState, settings.inspectionEnabled, stopTimer, armTimer, startInspection, startTimer]);

    const handleKeyUp = useCallback((e) => {
        if (e.code === 'Space') {
            e.preventDefault();

            if (timerState === TIMER_STATES.ARMED) {
                if (settings.inspectionEnabled) {
                    startInspection();
                } else {
                    startTimer();
                }
            }
        }
    }, [timerState, settings.inspectionEnabled, startInspection, startTimer]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleKeyDown, handleKeyUp]);

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

    const handleTouchStart = () => {
        if (timerState === TIMER_STATES.RUNNING) {
            stopTimer();
        } else if (timerState === TIMER_STATES.IDLE) {
            armTimer();
        } else if (timerState === TIMER_STATES.ARMED) {
            if (settings.inspectionEnabled) {
                startInspection();
            } else {
                startTimer();
            }
        } else if (timerState === TIMER_STATES.STOPPED && !showPenaltyButtons && pendingSolve) {
            handleConfirmSolve('none');
        }
    };

    return (
        <div className="flex flex-col items-center">
            <div
                className="relative cursor-pointer select-none"
                onTouchStart={handleTouchStart}
            >
                <div className={`text-8xl md:text-9xl font-mono font-bold transition-colors ${getTimerColor()}`}>
                    {timerState === TIMER_STATES.INSPECTION
                        ? inspectionRemaining
                        : formatTime(displayTime)
                    }
                </div>
            </div>

            <p className="text-zinc-400 mt-4 mb-6 text-center">
                {getStatusText()}
            </p>

            {showPenaltyButtons && pendingSolve && (
                <div className="flex gap-3 mb-4 animate-in fade-in slide-in-from-top-2">
                    <Button
                        variant="outline"
                        onClick={() => handlePenalty('+2')}
                        className="border-orange-500/50 text-orange-400 hover:bg-orange-500/20"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        +2
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => handlePenalty('DNF')}
                        className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                    >
                        <X className="w-4 h-4 mr-1" />
                        DNF
                    </Button>
                    <Button
                        variant="default"
                        onClick={() => handlePenalty('none')}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        Confirm
                    </Button>
                </div>
            )}

            {!showPenaltyButtons && (timerState === TIMER_STATES.IDLE || timerState === TIMER_STATES.STOPPED) && (
                <div className="text-xs text-zinc-500">
                    {timerState === TIMER_STATES.STOPPED ? 'Tap or SPACE for next solve' : ''}
                </div>
            )}
        </div>
    );
}
