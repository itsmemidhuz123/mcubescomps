'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { TIMER_STATES } from './useTimerEngine';

export function useBattleTimer(settings = {}) {
  const {
    inspectionEnabled = true,
    inspectionTime = 15000,
    freezeTime = 200,
  } = settings;

  const [timerState, setTimerState] = useState(TIMER_STATES.IDLE);
  const [time, setTime] = useState(0);
  const [inspectionTimeLeft, setInspectionTimeLeft] = useState(inspectionTime);
  const [penalty, setPenalty] = useState('none');

  const startTimeRef = useRef(null);
  const inspectionStartTimeRef = useRef(null);
  const inspectionIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const solvedTimeRef = useRef(null);

  const startInspection = useCallback(() => {
    if (!inspectionEnabled) {
      startSolveTimer();
      return;
    }

    setTimerState(TIMER_STATES.INSPECTION);
    setInspectionTimeLeft(inspectionTime);
    setPenalty('none');
    inspectionStartTimeRef.current = performance.now();

    inspectionIntervalRef.current = setInterval(() => {
      const elapsed = performance.now() - inspectionStartTimeRef.current;
      const remaining = Math.max(inspectionTime - elapsed, -3000);
      
      setInspectionTimeLeft(remaining);

      if (remaining <= -2000) {
        clearInterval(inspectionIntervalRef.current);
        setPenalty('DNF');
        setTimerState(TIMER_STATES.STOPPED);
        setTime(0);
        solvedTimeRef.current = 0;
      } else if (remaining <= 0) {
        setTime(remaining);
      }
    }, 50);
  }, [inspectionEnabled, inspectionTime]);

  const startSolveTimer = useCallback(() => {
    clearInterval(inspectionIntervalRef.current);
    inspectionIntervalRef.current = null;
    
    setTimerState(TIMER_STATES.RUNNING);
    setTime(0);
    setInspectionTimeLeft(0);
    startTimeRef.current = performance.now();

    timerIntervalRef.current = setInterval(() => {
      const elapsed = performance.now() - startTimeRef.current;
      setTime(elapsed);
    }, 10);
  }, []);

  const stop = useCallback(() => {
    clearInterval(timerIntervalRef.current);
    clearInterval(inspectionIntervalRef.current);
    timerIntervalRef.current = null;
    inspectionIntervalRef.current = null;

    if (timerState === TIMER_STATES.INSPECTION) {
      const inspectionElapsed = performance.now() - inspectionStartTimeRef.current;
      
      if (inspectionElapsed > inspectionTime + 2000) {
        setPenalty('DNF');
        solvedTimeRef.current = 0;
        setTime(0);
      } else if (inspectionElapsed > inspectionTime) {
        setPenalty('+2');
        solvedTimeRef.current = inspectionElapsed;
        setTime(inspectionElapsed);
        startSolveTimer();
        return;
      } else {
        startSolveTimer();
        return;
      }
    } else if (timerState === TIMER_STATES.RUNNING) {
      const finalTime = performance.now() - startTimeRef.current;
      solvedTimeRef.current = finalTime;
      setTime(finalTime);
    }
    
    setTimerState(TIMER_STATES.STOPPED);
    inspectionStartTimeRef.current = null;
  }, [timerState, inspectionTime, startSolveTimer]);

  const reset = useCallback(() => {
    clearInterval(timerIntervalRef.current);
    clearInterval(inspectionIntervalRef.current);
    timerIntervalRef.current = null;
    inspectionIntervalRef.current = null;

    setTimerState(TIMER_STATES.IDLE);
    setTime(0);
    setInspectionTimeLeft(inspectionTime);
    setPenalty('none');
    startTimeRef.current = null;
    inspectionStartTimeRef.current = null;
    solvedTimeRef.current = null;
  }, [inspectionTime]);

  const handleAction = useCallback(() => {
    switch (timerState) {
      case TIMER_STATES.IDLE:
        startInspection();
        break;
      case TIMER_STATES.INSPECTION:
      case TIMER_STATES.RUNNING:
        stop();
        break;
      case TIMER_STATES.STOPPED:
        reset();
        break;
      default:
        break;
    }
  }, [timerState, startInspection, stop, reset]);

  // Simple touch handling - tap to start/stop like PC space bar
  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (timerState === TIMER_STATES.IDLE) {
      startInspection();
    }
  }, [timerState, startInspection]);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (timerState === TIMER_STATES.INSPECTION || timerState === TIMER_STATES.RUNNING) {
      stop();
    } else if (timerState === TIMER_STATES.STOPPED) {
      reset();
    }
  }, [timerState, stop, reset]);

  const getFinalTime = useCallback(() => {
    if (solvedTimeRef.current === null || solvedTimeRef.current === undefined) {
      return time;
    }
    
    let finalTime = solvedTimeRef.current;
    if (penalty === '+2') {
      finalTime += 2000;
    }
    return finalTime;
  }, [penalty, time]);

  const getPenaltyValue = useCallback(() => {
    if (penalty === '+2') return 2;
    if (penalty === 'DNF') return -1;
    return 0;
  }, [penalty]);

  const submitCurrentSolve = useCallback(() => {
    const finalTime = getFinalTime();
    const penaltyValue = getPenaltyValue();
    
    if (finalTime === null || typeof finalTime !== 'number' || finalTime < 0) {
      return {
        time: null,
        penalty: null,
        valid: false,
      };
    }
    
    return {
      time: finalTime,
      penalty: penaltyValue,
      valid: true,
    };
  }, [getFinalTime, getPenaltyValue]);

  useEffect(() => {
    return () => {
      clearInterval(timerIntervalRef.current);
      clearInterval(inspectionIntervalRef.current);
    };
  }, []);

  return {
    timerState,
    time,
    inspectionTimeLeft,
    penalty,
    setPenalty,
    handleAction,
    handleTouchStart,
    handleTouchEnd,
    reset,
    submitCurrentSolve,
    getFinalTime,
  };
}
