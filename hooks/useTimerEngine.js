"use client";

import { useState, useRef, useCallback, useEffect } from 'react';

export const TIMER_STATES = {
  IDLE: 'idle',
  ARMED: 'armed',
  INSPECTION: 'inspection',
  RUNNING: 'running',
  STOPPED: 'stopped',
};

export function useTimerEngine(settings = {}) {
  const {
    inspectionEnabled = false,
    inspectionTime = 15,
    freezeTime = 200,
    autoConfirm = false,
  } = settings;

  const [timerState, setTimerState] = useState(TIMER_STATES.IDLE);
  const [time, setTime] = useState(0);
  const [inspectionTimeLeft, setInspectionTimeLeft] = useState(inspectionTime);
  const [penalty, setPenalty] = useState('none');

  const startTimeRef = useRef(null);
  const inspectionIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);

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
        return prev - 1;
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

  useEffect(() => {
    return () => {
      clearInterval(timerIntervalRef.current);
      clearInterval(inspectionIntervalRef.current);
    };
  }, []);

  const getTimeMs = useCallback(() => {
    let ms = time;
    if (penalty === '+2') ms += 2000;
    return ms;
  }, [time, penalty]);

  return {
    timerState,
    time,
    inspectionTimeLeft,
    penalty,
    setPenalty,
    handleAction,
    reset,
    getTimeMs,
    isInspectionEnabled: inspectionEnabled,
  };
}
