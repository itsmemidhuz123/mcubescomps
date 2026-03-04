"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTimerEngine, TIMER_STATES } from '@/hooks/useTimerEngine';
import { useTimerStorage } from '@/hooks/useTimerStorage';

const WCA_EVENTS = [
  { id: '333', name: '3x3', icon: '⬜' },
  { id: '222', name: '2x2', icon: '🟦' },
  { id: '444', name: '4x4', icon: '🟧' },
  { id: '555', name: '5x5', icon: '🟥' },
  { id: '666', name: '6x6', icon: '🟫' },
  { id: '777', name: '7x7', icon: '⬛' },
  { id: 'pyram', name: 'Pyraminx', icon: '🔺' },
  { id: 'skewb', name: 'Skewb', icon: '💎' },
  { id: 'sq1', name: 'Square-1', icon: '🔳' },
  { id: 'clock', name: 'Clock', icon: '🕐' },
  { id: 'minx', name: 'Megaminx', icon: '⬟' },
];

export default function TimerPage() {
  const [currentEvent, setCurrentEvent] = useState('333');
  const [showEventMenu, setShowEventMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scramble, setScramble] = useState('');
  const [scrambleLoading, setScrambleLoading] = useState(true);
  const cubingRef = useRef(null);

  const generateScramble = useCallback(async (eventId = currentEvent) => {
    setScrambleLoading(true);
    try {
      if (!cubingRef.current) {
        const { randomScrambleForEvent } = await import('cubing/scramble');
        cubingRef.current = { randomScrambleForEvent };
      }
      const result = await cubingRef.current.randomScrambleForEvent(eventId, { worker: false });
      setScramble(result.toString());
    } catch (e) {
      console.error('Scramble error:', e);
      setScramble('');
    } finally {
      setScrambleLoading(false);
    }
  }, [currentEvent]);

  useEffect(() => {
    generateScramble(currentEvent);
  }, [currentEvent, generateScramble]);

  const { 
    timerState, 
    time, 
    inspectionTimeLeft, 
    penalty, 
    setPenalty, 
    handleAction, 
    reset,
    getTimeMs,
    isInspectionEnabled 
  } = useTimerEngine({ inspectionEnabled: true });

  const { getSession, addSolve, deleteSolve, resetSession } = useTimerStorage();
  
  const currentSession = getSession(currentEvent);
  const solves = currentSession.solves || [];

  const currentEventObj = WCA_EVENTS.find(e => e.id === currentEvent) || WCA_EVENTS[0];

  const formatTime = useCallback((ms) => {
    if (ms === 0 && timerState === TIMER_STATES.IDLE) return '0.00';
    
    let displayMs = ms;
    let displayPenalty = '';
    
    if (timerState === TIMER_STATES.STOPPED) {
      displayMs = getTimeMs();
      displayPenalty = penalty === '+2' ? '+2' : penalty === 'DNF' ? ' DNF' : '';
    }

    if (displayMs === null || displayMs === undefined) return '0.00';
    
    const totalSeconds = Math.floor(displayMs / 1000);
    const centiseconds = Math.floor((displayMs % 1000) / 10);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    let timeStr;
    if (minutes > 0) {
      timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    } else {
      timeStr = `${seconds}.${centiseconds.toString().padStart(2, '0')}`;
    }

    return timeStr + displayPenalty;
  }, [timerState, getTimeMs, penalty]);

  const getTimerColor = () => {
    switch (timerState) {
      case TIMER_STATES.ARMED:
        return 'text-yellow-400';
      case TIMER_STATES.INSPECTION:
        return inspectionTimeLeft <= 8 ? 'text-red-500' : 'text-yellow-400';
      case TIMER_STATES.RUNNING:
        return 'text-green-400';
      case TIMER_STATES.STOPPED:
        return 'text-blue-400';
      default:
        return 'text-white';
    }
  };

  const handleKeyDown = useCallback((e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (timerState === TIMER_STATES.IDLE || timerState === TIMER_STATES.ARMED) {
        handleAction();
      } else if (timerState === TIMER_STATES.RUNNING) {
        handleAction();
      } else if (timerState === TIMER_STATES.STOPPED) {
        reset();
      }
    }
  }, [timerState, handleAction, reset]);

  const handleKeyUp = useCallback((e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (timerState === TIMER_STATES.ARMED) {
        handleAction();
      }
    }
  }, [timerState, handleAction]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const handleStop = () => {
    if (timerState === TIMER_STATES.RUNNING) {
      handleAction();
    }
  };

  const handleSaveSolve = () => {
    if (timerState === TIMER_STATES.STOPPED) {
      const timeMs = getTimeMs();
      addSolve(currentEvent, {
        time: timeMs,
        penalty: penalty,
        scramble: scramble,
      });
      reset();
      generateScramble();
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const getBest = () => {
    const validSolves = solves.filter(s => s.penalty !== 'DNF');
    if (validSolves.length === 0) return null;
    return Math.min(...validSolves.map(s => s.penalty === '+2' ? s.time + 2000 : s.time));
  };

  const getAo5 = () => {
    const validSolves = solves.filter(s => s.penalty !== 'DNF');
    if (validSolves.length < 5) return null;
    const recent = validSolves.slice(0, 5);
    const times = recent.map(s => s.penalty === '+2' ? s.time + 2000 : s.time);
    const sorted = [...times].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  };

  const best = getBest();
  const ao5 = getAo5();

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Top Bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowEventMenu(!showEventMenu)}
              className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-lg hover:bg-zinc-700"
            >
              <span>{currentEventObj.icon}</span>
              <span className="text-sm font-medium">{currentEventObj.name}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showEventMenu && (
              <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                {WCA_EVENTS.map(event => (
                  <button
                    key={event.id}
                    onClick={() => {
                      setCurrentEvent(event.id);
                      setShowEventMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left hover:bg-zinc-700 flex items-center gap-2 ${event.id === currentEvent ? 'bg-zinc-700' : ''}`}
                  >
                    <span>{event.icon}</span>
                    <span>{event.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => resetSession(currentEvent)}
            className="p-2 text-zinc-400 hover:text-white"
            title="Reset Session"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 text-zinc-400 hover:text-white"
            title="Fullscreen"
          >
            {isFullscreen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Scramble Section */}
      <div className="bg-zinc-900/50 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">Scramble</span>
          <button
            onClick={() => generateScramble()}
            disabled={scrambleLoading}
            className="p-1 text-zinc-400 hover:text-white disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${scrambleLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        <p className="font-mono text-sm text-zinc-300 break-all">
          {scrambleLoading ? 'Loading...' : scramble || 'Press refresh to generate'}
        </p>
      </div>

      {/* Timer Display */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div 
          onPointerDown={() => {
            if (timerState === TIMER_STATES.IDLE) {
              handleAction();
            }
          }}
          onPointerUp={() => {
            if (timerState === TIMER_STATES.ARMED) {
              handleAction();
            }
          }}
          className="text-center cursor-pointer select-none"
        >
          {timerState === TIMER_STATES.INSPECTION && (
            <div className="text-2xl text-yellow-400 mb-4">
              {inspectionTimeLeft}
            </div>
          )}
          
          <div className={`text-8xl font-bold font-mono tracking-tight ${getTimerColor()}`}>
            {formatTime(time)}
          </div>

          <div className="mt-4 text-zinc-500 text-sm">
            {timerState === TIMER_STATES.IDLE && 'Press Space to start'}
            {timerState === TIMER_STATES.ARMED && 'Release to start'}
            {timerState === TIMER_STATES.INSPECTION && 'Inspecting...'}
            {timerState === TIMER_STATES.RUNNING && 'Press Space to stop'}
            {timerState === TIMER_STATES.STOPPED && 'Solved!'}
          </div>
        </div>

        {/* Solve Actions */}
        {timerState === TIMER_STATES.STOPPED && (
          <div className="mt-8 flex gap-3">
            <button
              onClick={() => setPenalty(penalty === '+2' ? 'none' : '+2')}
              className={`px-4 py-2 rounded-lg ${penalty === '+2' ? 'bg-yellow-600' : 'bg-zinc-700'} hover:bg-zinc-600`}
            >
              +2
            </button>
            <button
              onClick={() => setPenalty(penalty === 'DNF' ? 'none' : 'DNF')}
              className={`px-4 py-2 rounded-lg ${penalty === 'DNF' ? 'bg-red-600' : 'bg-zinc-700'} hover:bg-zinc-600`}
            >
              DNF
            </button>
            <button
              onClick={handleSaveSolve}
              className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium"
            >
              Save
            </button>
            <button
              onClick={reset}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg"
            >
              Skip
            </button>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="bg-zinc-900 border-t border-zinc-800 px-4 py-3">
        <div className="flex justify-center gap-8">
          <div className="text-center">
            <div className="text-xs text-zinc-500 uppercase">Best</div>
            <div className="text-lg font-bold text-green-400">
              {best ? formatTime(best).split(' ')[0] : '--'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-zinc-500 uppercase">Ao5</div>
            <div className="text-lg font-bold text-blue-400">
              {ao5 ? formatTime(ao5).split(' ')[0] : '--'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-zinc-500 uppercase">Solves</div>
            <div className="text-lg font-bold text-purple-400">
              {solves.length}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Solves */}
      {solves.length > 0 && (
        <div className="bg-zinc-900 border-t border-zinc-800 max-h-48 overflow-y-auto">
          <div className="px-4 py-2 text-xs text-zinc-500 uppercase">Recent</div>
          {solves.slice(0, 10).map((solve, index) => (
            <div
              key={solve.id}
              className="flex items-center justify-between px-4 py-2 border-t border-zinc-800"
            >
              <span className="text-zinc-500 text-sm">#{index + 1}</span>
              <span className={`font-mono ${solve.penalty === 'DNF' ? 'text-red-400' : 'text-white'}`}>
                {formatTime(solve.time).split(' ')[0]}
                {solve.penalty === '+2' && <span className="text-yellow-400">+2</span>}
                {solve.penalty === 'DNF' && <span className="text-red-400"> DNF</span>}
              </span>
              <button
                onClick={() => deleteSolve(currentEvent, solve.id)}
                className="text-zinc-500 hover:text-red-400"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
