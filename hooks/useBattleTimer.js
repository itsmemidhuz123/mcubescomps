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
  const inspectionIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const solvedTimeRef = useRef(null);

  const arm = useCallback(() => {
    if (timerState === TIMER_STATES.IDLE) {
      setTimerState(TIMER_STATES.ARMED);
    }
  }, [timerState]);

  const startInspection = useCallback(() => {
    if (!inspectionEnabled) {
      startTimer();
      return;
    }

    setTimerState(TIMER_STATES.INSPECTION);
    setInspectionTimeLeft(inspectionTime);

    inspectionIntervalRef.current = setInterval(() => {
      setInspectionTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(inspectionIntervalRef.current);
          startTimer();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
  }, [inspectionEnabled, inspectionTime]);

  const startTimer = useCallback(() => {
    setTimerState(TIMER_STATES.RUNNING);
    setTime(0);
    startTimeRef.current = performance.now();

    timerIntervalRef.current = setInterval(() => {
      const elapsed = performance.now() - startTimeRef.current;
      setTime(elapsed);
    }, 10);
  }, []);

  const stop = useCallback(() => {
    if (timerState !== TIMER_STATES.RUNNING) return;

    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;

    const finalTime = performance.now() - startTimeRef.current;
    solvedTimeRef.current = finalTime;
    setTime(finalTime);
    setTimerState(TIMER_STATES.STOPPED);
  }, [timerState]);

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
    
    if (finalTime === null) {
      return {
        time: 0,
        penalty: 0,
      };
    }
    
    return {
      time: finalTime,
      penalty: penaltyValue,
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
    reset,
    getFinalTime,
    getPenaltyValue,
    submitCurrentSolve,
    isInspectionEnabled: inspectionEnabled,
  };
}
