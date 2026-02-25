import { useState, useCallback, useRef, useEffect } from 'react';

export const TIMER_STATES = {
    IDLE: 'idle',
    ARMED: 'armed',
    INSPECTION: 'inspection',
    RUNNING: 'running',
    STOPPED: 'stopped'
};

export const useTimerEngine = (options = {}) => {
    const {
        inspectionEnabled = false,
        inspectionTime = 15,
        onTimerStop = () => { }
    } = options;

    const [timerState, setTimerState] = useState(TIMER_STATES.IDLE);
    const [displayTime, setDisplayTime] = useState(0);
    const [inspectionRemaining, setInspectionRemaining] = useState(inspectionTime);
    const [inspectionPenalty, setInspectionPenalty] = useState('none');
    const [pendingSolve, setPendingSolve] = useState(null);

    const startTimeRef = useRef(null);
    const inspectionStartRef = useRef(null);
    const rafIdRef = useRef(null);
    const inspectionRafIdRef = useRef(null);
    const holdTimerRef = useRef(null);
    const inspectionPenaltyRef = useRef('none');
    const inspectionEndedRef = useRef(false);

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

    const stopInspection = useCallback(() => {
        if (inspectionRafIdRef.current) {
            cancelAnimationFrame(inspectionRafIdRef.current);
            inspectionRafIdRef.current = null;
        }
        inspectionEndedRef.current = true;
        setTimerState(TIMER_STATES.IDLE);
    }, []);

    const updateInspectionDisplay = useCallback(() => {
        if (inspectionStartRef.current !== null && !inspectionEndedRef.current) {
            const elapsed = performance.now() - inspectionStartRef.current;
            const remaining = (inspectionTime * 1000) - elapsed;
            const remainingSeconds = Math.ceil(remaining / 1000);
            setInspectionRemaining(remainingSeconds);

            if (remainingSeconds < -2) {
                setInspectionPenalty('DNF');
                inspectionPenaltyRef.current = 'DNF';
                stopInspection();
            } else if (remainingSeconds < 0) {
                setInspectionPenalty('+2');
                inspectionPenaltyRef.current = '+2';
            } else if (remaining <= 0) {
                stopInspection();
            } else {
                inspectionRafIdRef.current = requestAnimationFrame(updateInspectionDisplay);
            }
        }
    }, [inspectionTime, stopInspection]);

    const startTimerWithPenalty = useCallback(() => {
        if (inspectionRafIdRef.current) {
            cancelAnimationFrame(inspectionRafIdRef.current);
            inspectionRafIdRef.current = null;
        }

        const penalty = inspectionPenaltyRef.current;
        setTimerState(TIMER_STATES.RUNNING);
        setInspectionRemaining(inspectionTime);
        setInspectionPenalty('none');
        inspectionPenaltyRef.current = 'none';
        inspectionEndedRef.current = false;
        startTimeRef.current = performance.now();
        rafIdRef.current = requestAnimationFrame(updateDisplay);

        return penalty;
    }, [inspectionTime, updateDisplay]);

    const startTimer = useCallback(() => {
        if (inspectionRafIdRef.current) {
            cancelAnimationFrame(inspectionRafIdRef.current);
            inspectionRafIdRef.current = null;
        }

        setTimerState(TIMER_STATES.RUNNING);
        setInspectionRemaining(inspectionTime);
        setInspectionPenalty('none');
        inspectionPenaltyRef.current = 'none';
        startTimeRef.current = performance.now();
        rafIdRef.current = requestAnimationFrame(updateDisplay);
    }, [inspectionTime, updateDisplay]);

    const stopTimer = useCallback((forceStop = false) => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }

        let finalTime = startTimeRef.current !== null
            ? performance.now() - startTimeRef.current
            : 0;

        let penalty = forceStop ? 'DNF' : 'none';

        if (timerState === TIMER_STATES.RUNNING && inspectionPenaltyRef.current !== 'none' && !forceStop) {
            penalty = inspectionPenaltyRef.current;
            if (penalty === '+2') {
                finalTime = finalTime + 2000;
            }
        }

        startTimeRef.current = null;
        setTimerState(TIMER_STATES.STOPPED);
        setDisplayTime(finalTime);

        const solve = {
            time: finalTime,
            penalty: penalty,
            createdAt: Date.now()
        };

        setPendingSolve(solve);
        onTimerStop(solve);

        return solve;
    }, [onTimerStop, timerState]);

    const startInspection = useCallback(() => {
        if (!inspectionEnabled) {
            startTimer();
            return;
        }

        inspectionEndedRef.current = false;
        inspectionPenaltyRef.current = 'none';
        setTimerState(TIMER_STATES.INSPECTION);
        setInspectionRemaining(inspectionTime);
        setInspectionPenalty('none');
        inspectionStartRef.current = performance.now();
        inspectionRafIdRef.current = requestAnimationFrame(updateInspectionDisplay);
    }, [inspectionEnabled, inspectionTime, startTimer, updateInspectionDisplay]);

    const armTimer = useCallback(() => {
        if (timerState === TIMER_STATES.IDLE || timerState === TIMER_STATES.STOPPED) {
            setTimerState(TIMER_STATES.ARMED);
        }
    }, [timerState]);

    const unarmTimer = useCallback(() => {
        if (timerState === TIMER_STATES.ARMED) {
            setTimerState(TIMER_STATES.IDLE);
        }
    }, [timerState]);

    const handlePressStart = useCallback(() => {
        if (timerState === TIMER_STATES.RUNNING) {
            return stopTimer();
        }

        if (timerState === TIMER_STATES.IDLE) {
            armTimer();
            return null;
        }

        if (timerState === TIMER_STATES.ARMED) {
            if (inspectionEnabled) {
                startInspection();
            } else {
                startTimer();
            }
            return null;
        }

        return null;
    }, [timerState, inspectionEnabled, armTimer, startInspection, startTimer, stopTimer]);

    const handlePressEnd = useCallback(() => {
        if (timerState === TIMER_STATES.ARMED) {
            if (inspectionEnabled) {
                if (inspectionEndedRef.current) {
                    startTimerWithPenalty();
                } else {
                    startInspection();
                }
            } else {
                startTimer();
            }
        }
    }, [timerState, inspectionEnabled, startInspection, startTimerWithPenalty, startTimer]);

    const resetTimer = useCallback(() => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        if (inspectionRafIdRef.current) {
            cancelAnimationFrame(inspectionRafIdRef.current);
            inspectionRafIdRef.current = null;
        }
        if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }

        startTimeRef.current = null;
        inspectionStartRef.current = null;
        inspectionPenaltyRef.current = 'none';
        inspectionEndedRef.current = false;
        setTimerState(TIMER_STATES.IDLE);
        setDisplayTime(0);
        setInspectionRemaining(inspectionTime);
        setInspectionPenalty('none');
        setPendingSolve(null);
    }, [inspectionTime]);

    const applyPenalty = useCallback((penalty) => {
        if (pendingSolve) {
            const updatedSolve = { ...pendingSolve, penalty };
            setPendingSolve(updatedSolve);
            onTimerStop(updatedSolve, true);
            return updatedSolve;
        }
        return null;
    }, [pendingSolve, onTimerStop]);

    const clearPendingSolve = useCallback(() => {
        setPendingSolve(null);
    }, []);

    useEffect(() => {
        return () => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            if (inspectionRafIdRef.current) cancelAnimationFrame(inspectionRafIdRef.current);
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        };
    }, []);

    return {
        timerState,
        displayTime,
        inspectionRemaining,
        inspectionPenalty,
        pendingSolve,
        formatTime,
        startTimer,
        stopTimer,
        startInspection,
        armTimer,
        unarmTimer,
        handlePressStart,
        handlePressEnd,
        resetTimer,
        applyPenalty,
        clearPendingSolve,
        isRunning: timerState === TIMER_STATES.RUNNING,
        isInspecting: timerState === TIMER_STATES.INSPECTION,
        isArmed: timerState === TIMER_STATES.ARMED,
        isStopped: timerState === TIMER_STATES.STOPPED
    };
};