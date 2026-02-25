import { useState, useCallback, useRef, useEffect } from 'react';

export const TIMER_STATES = {
    IDLE: 'idle',
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
    const [inspectionTimeLeft, setInspectionTimeLeft] = useState(inspectionTime);
    const [pendingSolve, setPendingSolve] = useState(null);
    const [inspectionPenalty, setInspectionPenalty] = useState('none');

    const startTimeRef = useRef(null);
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

    const formatInspectionTime = (seconds) => {
        // Show +2 for -1 and -2 seconds (penalty zone)
        if (seconds === -1 || seconds === -2) {
            return '+2';
        }
        // Show DNF for below -2
        if (seconds < -2) {
            return 'DNF';
        }
        // Show normal countdown
        return String(seconds);
    };

    // Auto-save DNF solve when inspection exceeds -2
    const saveDnfSolve = useCallback(() => {
        const dnfSolve = {
            time: 0,
            penalty: 'DNF',
            createdAt: Date.now()
        };
        setPendingSolve(dnfSolve);
        onTimerStop(dnfSolve);
    }, [onTimerStop]);

    const updateDisplay = useCallback(() => {
        if (startTimeRef.current !== null) {
            const elapsed = performance.now() - startTimeRef.current;
            setDisplayTime(elapsed);
            rafIdRef.current = requestAnimationFrame(updateDisplay);
        }
    }, []);

    const startTimer = useCallback(() => {
        if (inspectionRafIdRef.current) {
            clearTimeout(inspectionRafIdRef.current);
            inspectionRafIdRef.current = null;
        }

        let penalty = 'none';

        if (inspectionStartRef.current !== null) {
            const elapsed = performance.now() - inspectionStartRef.current;
            const elapsedSeconds = elapsed / 1000;
            const timeOver = elapsedSeconds - inspectionTime;

            if (timeOver >= 2) {
                penalty = 'DNF';
            } else if (timeOver > 0) {
                penalty = '+2';
            }
            inspectionStartRef.current = null;
        }

        setInspectionPenalty(penalty);
        setTimerState(TIMER_STATES.RUNNING);
        setInspectionTimeLeft(inspectionTime);
        startTimeRef.current = performance.now();
        setDisplayTime(0);
        rafIdRef.current = requestAnimationFrame(updateDisplay);

        return penalty;
    }, [inspectionTime, updateDisplay]);

    const stopTimer = useCallback(() => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }

        let finalTime = startTimeRef.current !== null
            ? performance.now() - startTimeRef.current
            : 0;

        startTimeRef.current = null;
        setTimerState(TIMER_STATES.STOPPED);
        setDisplayTime(finalTime);

        const solve = {
            time: finalTime,
            penalty: inspectionPenalty,
            createdAt: Date.now()
        };

        setPendingSolve(solve);
        onTimerStop(solve);

        return solve;
    }, [inspectionPenalty, onTimerStop]);

    const startInspection = useCallback(() => {
        if (!inspectionEnabled) {
            startTimer();
            return;
        }

        setTimerState(TIMER_STATES.INSPECTION);
        setInspectionTimeLeft(inspectionTime);
        setInspectionPenalty('none');
        inspectionStartRef.current = performance.now();

        const tick = () => {
            if (inspectionStartRef.current === null) return;

            const elapsed = performance.now() - inspectionStartRef.current;
            const elapsedSeconds = elapsed / 1000;
            const remaining = inspectionTime - elapsedSeconds;

            // Calculate penalty in real-time
            let currentPenalty = 'none';
            if (remaining >= -2 && remaining < 0) {
                currentPenalty = '+2';
            } else if (remaining < -2) {
                currentPenalty = 'DNF';
            }

            setInspectionPenalty(currentPenalty);
            setInspectionTimeLeft(Math.floor(remaining));

            // Auto-DNF if past -2 seconds
            if (remaining < -2) {
                setTimerState(TIMER_STATES.STOPPED);
                setInspectionPenalty('DNF');
                inspectionStartRef.current = null;
                saveDnfSolve();
                return;
            }

            inspectionRafIdRef.current = setTimeout(tick, 100);
        };

        tick();
    }, [inspectionEnabled, inspectionTime, startTimer]);

    const resetTimer = useCallback(() => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        if (inspectionRafIdRef.current) {
            clearTimeout(inspectionRafIdRef.current);
            inspectionRafIdRef.current = null;
        }

        startTimeRef.current = null;
        inspectionStartRef.current = null;
        setTimerState(TIMER_STATES.IDLE);
        setDisplayTime(0);
        setInspectionTimeLeft(inspectionTime);
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
            if (inspectionRafIdRef.current) clearTimeout(inspectionRafIdRef.current);
        };
    }, []);

    return {
        timerState,
        displayTime,
        inspectionRemaining: inspectionTimeLeft,
        pendingSolve,
        inspectionPenalty,
        formatTime,
        formatInspectionTime,
        startTimer,
        stopTimer,
        startInspection,
        resetTimer,
        applyPenalty,
        clearPendingSolve,
        isRunning: timerState === TIMER_STATES.RUNNING,
        isInspecting: timerState === TIMER_STATES.INSPECTION,
        isStopped: timerState === TIMER_STATES.STOPPED,
        isIdle: timerState === TIMER_STATES.IDLE
    };
};