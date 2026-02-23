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
    const [pendingSolve, setPendingSolve] = useState(null);

    const startTimeRef = useRef(null);
    const inspectionStartRef = useRef(null);
    const rafIdRef = useRef(null);
    const inspectionRafIdRef = useRef(null);
    const holdTimerRef = useRef(null);

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
            const remaining = Math.max(0, (inspectionTime * 1000) - elapsed);
            setInspectionRemaining(Math.ceil(remaining / 1000));

            if (remaining <= 0) {
                startTimer();
            } else {
                inspectionRafIdRef.current = requestAnimationFrame(updateInspectionDisplay);
            }
        }
    }, [inspectionTime]);

    const startTimer = useCallback(() => {
        if (inspectionRafIdRef.current) {
            cancelAnimationFrame(inspectionRafIdRef.current);
            inspectionRafIdRef.current = null;
        }

        setTimerState(TIMER_STATES.RUNNING);
        setInspectionRemaining(inspectionTime);
        startTimeRef.current = performance.now();
        rafIdRef.current = requestAnimationFrame(updateDisplay);
    }, [inspectionTime, updateDisplay]);

    const stopTimer = useCallback(() => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }

        const finalTime = startTimeRef.current !== null
            ? performance.now() - startTimeRef.current
            : 0;

        startTimeRef.current = null;
        setTimerState(TIMER_STATES.STOPPED);
        setDisplayTime(finalTime);

        const solve = {
            time: finalTime,
            penalty: 'none',
            createdAt: Date.now()
        };

        setPendingSolve(solve);
        onTimerStop(solve);

        return solve;
    }, [onTimerStop]);

    const startInspection = useCallback(() => {
        if (!inspectionEnabled) {
            startTimer();
            return;
        }

        setTimerState(TIMER_STATES.INSPECTION);
        setInspectionRemaining(inspectionTime);
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
                startInspection();
            } else {
                startTimer();
            }
        }
    }, [timerState, inspectionEnabled, startInspection, startTimer]);

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
        setTimerState(TIMER_STATES.IDLE);
        setDisplayTime(0);
        setInspectionRemaining(inspectionTime);
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