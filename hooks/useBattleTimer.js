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

  const arm = useCallback(() => {
    if (timerState === TIMER_STATES.IDLE) {
      setTimerState(TIMER_STATES.ARMED);
    }
  }, [timerState]);

  const disarm = useCallback(() => {
    if (timerState === TIMER_STATES.ARMED) {
      setTimerState(TIMER_STATES.IDLE);
    }
  }, [timerState]);

  const startInspection = useCallback(() => {
    if (!inspectionEnabled) {
      startTimer();
      return;
    }

    setTimerState(TIMER_STATES.INSPECTION);
    setInspectionTimeLeft(inspectionTime);
    inspectionStartTimeRef.current = performance.now();

    inspectionIntervalRef.current = setInterval(() => {
      const elapsed = performance.now() - inspectionStartTimeRef.current;
      const remaining = Math.max(inspectionTime - elapsed, -3000); // Allow up to -3 seconds
      
      setInspectionTimeLeft(remaining);

      if (remaining <= -2000) {
        clearInterval(inspectionIntervalRef.current);
        setPenalty('DNF');
        setTimerState(TIMER_STATES.STOPPED);
        setTime(0);
        solvedTimeRef.current = 0;
      } else if (remaining <= 0) {
        // Timer goes negative during inspection
        setTime(remaining);
      }
      
      if (remaining <= 0 && !inspectionIntervalRef.current) {
        startTimer();
      }
    }, 50);
  }, [inspectionEnabled, inspectionTime]);

  const startTimer = useCallback(() => {
    clearInterval(inspectionIntervalRef.current);
    inspectionIntervalRef.current = null;
    
    setTimerState(TIMER_STATES.RUNNING);
    setTime(0);
    startTimeRef.current = performance.now();

    timerIntervalRef.current = setInterval(() => {
      const elapsed = performance.now() - startTimeRef.current;
      setTime(elapsed);
    }, 10);
  }, []);

  const stop = useCallback(() => {
    if (timerState !== TIMER_STATES.RUNNING && timerState !== TIMER_STATES.INSPECTION) return;

    clearInterval(timerIntervalRef.current);
    clearInterval(inspectionIntervalRef.current);
    timerIntervalRef.current = null;
    inspectionIntervalRef.current = null;

    const finalTime = performance.now() - startTimeRef.current;
    solvedTimeRef.current = finalTime;
    
    // Check if inspection went past 0
    if (inspectionStartTimeRef.current !== null && timerState === TIMER_STATES.INSPECTION) {
      const inspectionElapsed = performance.now() - inspectionStartTimeRef.current;
      
      if (inspectionElapsed > inspectionTime + 2000) {
        // More than 2 seconds over inspection = DNF
        setPenalty('DNF');
        solvedTimeRef.current = 0;
        setTime(0);
      } else if (inspectionElapsed > inspectionTime) {
        // 0-2 seconds over = +2
        setPenalty('+2');
        solvedTimeRef.current = inspectionElapsed;
        setTime(inspectionElapsed);
      } else {
        setTime(finalTime);
      }
    } else {
      setTime(finalTime);
    }
    
    setTimerState(TIMER_STATES.STOPPED);
    inspectionStartTimeRef.current = null;
  }, [timerState, inspectionTime]);

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
        arm();
        break;
      case TIMER_STATES.ARMED:
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
  }, [timerState, arm, startInspection, stop, reset]);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    if (timerState === TIMER_STATES.IDLE || timerState === TIMER_STATES.ARMED) {
      arm();
    }
  }, [timerState, arm]);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    if (timerState === TIMER_STATES.ARMED) {
      startInspection();
    } else if (timerState === TIMER_STATES.RUNNING || timerState === TIMER_STATES.INSPECTION) {
      stop();
    } else if (timerState === TIMER_STATES.STOPPED) {
      reset();
    }
  }, [timerState, startInspection, stop, reset]);

  const getFinalTime = useCallback(() => {
    if (solvedTimeRef.current === null) return null;
    
    let finalTime = solvedTimeRef.current;
    if (penalty === '+2') {
      finalTime += 2000;
    }
    return finalTime;
  }, [penalty]);

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
    getFinalTime,
    getPenaltyValue,
    submitCurrentSolve,
    isInspectionEnabled: inspectionEnabled,
  };
}
