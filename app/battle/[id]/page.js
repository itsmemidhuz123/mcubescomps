"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useBattle } from '@/hooks/useBattle';
import { useTimerEngine, TIMER_STATES } from '@/hooks/useTimerEngine';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { BATTLE_STATES } from '@/lib/battleUtils';
import { ResultCalculator } from '@/lib/battle/ResultCalculator';
import { Loader2, User, Users, Clock, Trophy, ArrowLeft, Check, Plus, X } from 'lucide-react';

export default function BattleArenaPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const battleId = params.id;

  const {
    battle,
    loading: battleLoading,
    countdown,
    playerRole,
    opponent,
    currentScramble,
    currentRound,
    totalRounds,
    mySolves,
    opponentSolves,
    player1Solves,
    player2Solves,
    mySolve,
    opponentSolve,
    player1Solve,
    player2Solve,
    submitSolve,
    startCountdown,
    nextRound,
    hasPlayerSubmittedCurrentRound,
    bothPlayersSubmitted,
    getMyAverage,
    getOpponentAverage,
  } = useBattle(battleId, user);

  const [penalty, setPenalty] = useState('none');
  const [solvedTime, setSolvedTime] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const { 
    timerState, 
    time, 
    inspectionTimeLeft, 
    setPenalty: setTimerPenalty, 
    reset: resetTimer,
    getTimeMs,
    handleAction,
  } = useTimerEngine({ inspectionEnabled: true });

  const timerRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat && battle?.status === BATTLE_STATES.LIVE) {
        e.preventDefault();
        
        switch (timerState) {
          case TIMER_STATES.IDLE:
            handleAction();
            break;
          case TIMER_STATES.ARMED:
            handleAction();
            break;
          case TIMER_STATES.INSPECTION:
            handleAction();
            break;
          case TIMER_STATES.RUNNING:
            handleAction();
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAction, battle?.status, timerState]);

  useEffect(() => {
    if (battle?.status === BATTLE_STATES.COMPLETED) {
      router.push(`/battle/${battleId}/result`);
    }
  }, [battle?.status, battleId, router]);

  useEffect(() => {
    if (battle?.status === BATTLE_STATES.WAITING && 
        battle?.player1 && 
        battle?.player2 &&
        battle?.player1 !== battle?.player2) {
      console.log('Starting countdown for battle:', battleId);
      startCountdown().catch(err => console.error('Failed to start countdown:', err));
    }
  }, [battle?.status, battle?.player1, battle?.player2, battleId]);

  useEffect(() => {
    if (countdown === 0 && battle?.status === BATTLE_STATES.COUNTDOWN) {
      const battleRef = doc(db, 'battles', battleId);
      updateDoc(battleRef, {
        status: BATTLE_STATES.LIVE,
        startedAt: new Date(),
      });
    }
  }, [countdown, battle?.status, battleId]);

  // Check if both players have completed current round by comparing solve array lengths
  // Check if both players have completed current round by checking solve's round property
  const bothCompletedCurrentSolve = useCallback(() => {
    if (!battle?.player1 || !battle?.player2 || !player1Solves || !player2Solves) return false;
    const p1Done = player1Solves.some(s => Number(s.round) === Number(currentRound));
    const p2Done = player2Solves.some(s => Number(s.round) === Number(currentRound));
    return p1Done && p2Done;
  }, [battle, player1Solves, player2Solves, currentRound]);

  // Check if opponent has completed current round (check solve's round property)
  const opponentCompletedCurrentRound = useCallback(() => {
    if (!battle || !playerRole || !player1Solves || !player2Solves) return false;
    if (playerRole === 'player1') {
      return player2Solves.some(s => Number(s.round) === Number(currentRound));
    } else if (playerRole === 'player2') {
      return player1Solves.some(s => Number(s.round) === Number(currentRound));
    }
    return false;
  }, [battle, playerRole, player1Solves, player2Solves, currentRound]);

  // Check if the round has advanced past our submitted solve
  const hasRoundAdvanced = useCallback(() => {
    // Round has advanced if:
    // 1. We had a solve but current round is now past it, OR
    // 2. We don't have a current solve (round was reset after submission)
    if (!mySolve) return true;
    return Number(mySolve.round) < Number(currentRound);
  }, [mySolve, currentRound]);

  const advancingRef = useRef(false);

  useEffect(() => {
    if (advancingRef.current) return;
    
    if (bothCompletedCurrentSolve() && battle?.status === BATTLE_STATES.LIVE) {
      if (currentRound < totalRounds) {
        advancingRef.current = true;
        console.log('Advancing to round', currentRound + 1);
        nextRound().finally(() => {
          setTimeout(() => { advancingRef.current = false; }, 1000);
        });
      } else if (currentRound === totalRounds) {
        advancingRef.current = true;
        console.log('All rounds completed - finalizing battle');
        nextRound().finally(() => {
          setTimeout(() => { advancingRef.current = false; }, 1000);
        });
      }
    }
  }, [bothCompletedCurrentSolve, battle?.status, currentRound, totalRounds, nextRound]);

  const handleSubmit = useCallback(async () => {
    if (submitted || timerState !== TIMER_STATES.STOPPED) return;

    const finalTime = getTimeMs();
    setSolvedTime(finalTime);

    await submitSolve(finalTime, penalty);
    setSubmitted(true);
  }, [submitted, timerState, getTimeMs, penalty, submitSolve]);

  const handleNextRound = useCallback(() => {
    resetTimer();
    setPenalty('none');
    setSubmitted(false);
    setSolvedTime(0);
  }, [resetTimer]);

  const prevRoundRef = useRef(null);
  
  useEffect(() => {
    // Only trigger on actual round changes (not initial load)
    if (battle?.currentRound && prevRoundRef.current !== null && battle.currentRound !== prevRoundRef.current) {
      console.log('Round changed from', prevRoundRef.current, 'to', battle.currentRound, '- resetting UI');
      prevRoundRef.current = battle.currentRound;
      handleNextRound();
    } else if (battle?.currentRound && prevRoundRef.current === null) {
      // Initial load - set the ref
      prevRoundRef.current = battle.currentRound;
    }
  }, [battle?.currentRound, handleNextRound]);

  const getStatusColor = () => {
    if (!battle) return 'text-zinc-500';
    switch (battle.status) {
      case BATTLE_STATES.WAITING:
        return 'text-yellow-500';
      case BATTLE_STATES.COUNTDOWN:
        return 'text-orange-500';
      case BATTLE_STATES.LIVE:
        return 'text-green-500';
      case BATTLE_STATES.COMPLETED:
        return 'text-red-500';
      default:
        return 'text-zinc-500';
    }
  };

  const formatTime = (ms) => {
    if (!ms || ms === 0) return '0.00';
    const totalSeconds = Math.floor(ms / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}.${centiseconds.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    switch (timerState) {
      case TIMER_STATES.ARMED:
        return 'text-yellow-400';
      case TIMER_STATES.INSPECTION:
        return inspectionTimeLeft <= 5 ? 'text-red-500' : 'text-orange-400';
      case TIMER_STATES.RUNNING:
        return 'text-green-500';
      case TIMER_STATES.STOPPED:
        return 'text-blue-500';
      default:
        return 'text-zinc-400';
    }
  };

  if (authLoading || battleLoading || !battle) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  if (!playerRole) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Checking battle...</p>
          <p className="text-zinc-500 text-sm mb-2">Battle ID: {battleId}</p>
          <p className="text-zinc-500 text-sm mb-2">Your UID: {user?.uid}</p>
          <p className="text-zinc-500 text-sm mb-2">Player1: {battle?.player1}</p>
          <p className="text-zinc-500 text-sm mb-4">Player2: {battle?.player2}</p>
          <Button onClick={() => router.push('/battle')}>Back to Arena</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/battle')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Battle</span>
            <span className={`font-bold ${getStatusColor()}`}>
              {battle.status.toUpperCase()}
            </span>
          </div>

          <div className="text-sm text-zinc-500">
            Round {currentRound}/{totalRounds}
          </div>
        </div>

        {battle.status === BATTLE_STATES.WAITING && (
          <WaitingRoom battle={battle} playerRole={playerRole} opponent={opponent} />
        )}

        {battle.status === BATTLE_STATES.COUNTDOWN && (
          <CountdownDisplay countdown={countdown} />
        )}

        {battle.status === BATTLE_STATES.LIVE && (
          <BattleField
            currentScramble={currentScramble}
            currentRound={currentRound}
            totalRounds={totalRounds}
            timerState={timerState}
            time={time}
            inspectionTimeLeft={inspectionTimeLeft}
            timerColor={getTimerColor()}
            handleAction={handleAction}
            playerRole={playerRole}
            battle={battle}
            mySolves={mySolves}
            opponentSolves={opponentSolves}
            player1Solves={player1Solves}
            player2Solves={player2Solves}
            mySolve={mySolve}
            opponentSolve={opponentSolve}
            formatTime={formatTime}
            submitted={submitted}
            setSubmitted={setSubmitted}
            penalty={penalty}
            setPenalty={setPenalty}
            solvedTime={solvedTime}
            handleSubmit={handleSubmit}
            opponent={opponent}
            user={user}
            hasPlayerSubmittedCurrentRound={hasPlayerSubmittedCurrentRound}
            opponentCompletedCurrentRound={opponentCompletedCurrentRound}
            hasRoundAdvanced={hasRoundAdvanced}
            bothCompletedCurrentSolve={bothCompletedCurrentSolve}
          />
        )}
      </div>
    </div>
  );
}

function WaitingRoom({ battle, playerRole, opponent }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Waiting for Opponent</h2>
        <p className="text-zinc-500">Preparing battle arena...</p>
      </div>

      <div className="flex items-center gap-8 mb-8">
        <PlayerCard
          name={battle.player1Name}
          isPlayer1={playerRole === 'player1'}
          isConnected={!!battle.player1}
        />
        <div className="text-3xl font-bold text-zinc-600">VS</div>
        <PlayerCard
          name={battle.player2Name || 'Waiting...'}
          isPlayer1={playerRole === 'player2'}
          isConnected={!!battle.player2}
        />
      </div>

      <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
    </div>
  );
}

function PlayerCard({ name, isPlayer1, isConnected }) {
  return (
    <div className={`bg-zinc-900 border-2 rounded-xl p-6 min-w-[160px] text-center ${
      isPlayer1 ? 'border-red-500' : 'border-zinc-800'
    }`}>
      <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center ${
        isConnected ? 'bg-zinc-800' : 'bg-zinc-900'
      }`}>
        <User className={`w-8 h-8 ${isConnected ? 'text-zinc-300' : 'text-zinc-600'}`} />
      </div>
      <p className="font-medium truncate">{name}</p>
      <p className={`text-xs mt-1 ${isConnected ? 'text-green-500' : 'text-zinc-600'}`}>
        {isConnected ? '● Connected' : '○ Waiting'}
      </p>
    </div>
  );
}

function CountdownDisplay({ countdown }) {
  const getScale = () => {
    if (countdown > 0) return 'scale-100';
    return 'scale-150';
  };

  const getColor = () => {
    if (countdown > 3) return 'text-white';
    if (countdown > 0) return 'text-yellow-400';
    return 'text-green-500';
  };

  const getText = () => {
    if (countdown > 0) return countdown;
    return 'GO!';
  };

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className={`transition-all duration-300 ${getScale()}`}>
        <p className={`text-9xl font-black ${getColor()}`}>
          {getText()}
        </p>
      </div>
      <p className="text-zinc-500 mt-4">Get Ready!</p>
    </div>
  );
}

function BattleField({
  currentScramble,
  currentRound,
  totalRounds,
  timerState,
  time,
  inspectionTimeLeft,
  timerColor,
  handleAction,
  playerRole,
  battle,
  mySolves,
  opponentSolves,
  player1Solves,
  player2Solves,
  mySolve,
  opponentSolve,
  formatTime,
  submitted,
  setSubmitted,
  penalty,
  setPenalty,
  solvedTime,
  handleSubmit,
  opponent,
  user,
  hasPlayerSubmittedCurrentRound,
  opponentCompletedCurrentRound,
  hasRoundAdvanced,
  bothCompletedCurrentSolve,
}) {
  const isMyTurn = hasPlayerSubmittedCurrentRound(user?.uid);

  useEffect(() => {
    if (submitted && currentRound) {
      const myCurrentSolve = playerRole === 'player1' 
        ? player1Solves?.find(s => Number(s.round) === Number(currentRound))
        : player2Solves?.find(s => Number(s.round) === Number(currentRound));
      
      if (!myCurrentSolve) {
        setSubmitted(false);
      }
    }
  }, [currentRound, submitted, player1Solves, player2Solves, playerRole]);

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <span className="text-zinc-500 text-sm">Scramble</span>
          <span className="text-zinc-600 text-xs">Round {currentRound}/{totalRounds}</span>
        </div>
        <p className="text-xl font-mono text-center tracking-wider">{currentScramble}</p>
      </div>

      <div 
        className="bg-zinc-900 rounded-xl p-8 border border-zinc-800 touch-none select-none"
        onClick={(e) => {
          if (battle?.status === BATTLE_STATES.LIVE && !submitted) {
            switch (timerState) {
              case TIMER_STATES.IDLE:
                handleAction();
                break;
              case TIMER_STATES.ARMED:
                handleAction();
                break;
              case TIMER_STATES.INSPECTION:
                handleAction();
                break;
              case TIMER_STATES.RUNNING:
                handleAction();
                break;
              default:
                break;
            }
          }
        }}
      >
        <div className="text-center mb-6">
          {timerState === TIMER_STATES.INSPECTION && (
            <div className="mb-4">
              <p className="text-zinc-500 text-sm mb-1">INSPECTION</p>
              <p className={`text-5xl font-bold ${inspectionTimeLeft <= 5 ? 'text-red-500' : 'text-orange-400'}`}>
                {inspectionTimeLeft}
              </p>
            </div>
          )}
          
          <p className={`text-7xl font-black tracking-wider ${timerColor}`}>
            {formatTime(timerState === TIMER_STATES.STOPPED ? solvedTime || time : time)}
          </p>

          {timerState === TIMER_STATES.STOPPED && (
            <p className="text-zinc-500 text-sm mt-2">
              {penalty === '+2' ? '+2 seconds' : penalty === 'DNF' ? 'DNF' : ''}
            </p>
          )}
        </div>

        {submitted ? (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 text-green-500 mb-4">
              <Check className="w-5 h-5" />
              <span>Solve Submitted</span>
            </div>
            {currentRound < totalRounds && !bothCompletedCurrentSolve() && (
              <p className="text-zinc-500">Waiting for next round...</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {timerState === TIMER_STATES.STOPPED ? (
              <div className="flex justify-center gap-3">
                <Button
                  onClick={() => setPenalty('none')}
                  variant={penalty === 'none' ? 'default' : 'outline'}
                  size="lg"
                  className={penalty === 'none' ? 'bg-green-600 hover:bg-green-500' : ''}
                >
                  <Check className="w-4 h-4 mr-2" />OK
                </Button>
                <Button
                  onClick={() => setPenalty('+2')}
                  variant={penalty === '+2' ? 'default' : 'outline'}
                  size="lg"
                  className={penalty === '+2' ? 'bg-yellow-600 hover:bg-yellow-500' : ''}
                >
                  <Plus className="w-4 h-4 mr-2" />+2
                </Button>
                <Button
                  onClick={() => setPenalty('DNF')}
                  variant={penalty === 'DNF' ? 'default' : 'outline'}
                  size="lg"
                  className={penalty === 'DNF' ? 'bg-red-600 hover:bg-red-500' : ''}
                >
                  <X className="w-4 h-4 mr-2" />DNF
                </Button>
              </div>
            ) : null}

            {timerState === TIMER_STATES.STOPPED ? (
              <Button
                onClick={handleSubmit}
                size="lg"
                className="w-full bg-blue-600 hover:bg-blue-500"
              >
                Submit Solve
              </Button>
            ) : (
              <Button
                onClick={handleAction}
                size="lg"
                className="w-full"
                disabled={timerState === TIMER_STATES.IDLE}
              >
                {timerState === TIMER_STATES.IDLE && 'Hold SPACE to arm'}
                {timerState === TIMER_STATES.ARMED && 'Release to start inspection'}
                {timerState === TIMER_STATES.INSPECTION && 'Release to start solve'}
                {timerState === TIMER_STATES.RUNNING && 'Press SPACE to stop'}
              </Button>
            )}

            <p className="text-center text-zinc-600 text-sm">
              {timerState === TIMER_STATES.IDLE && 'Press and hold SPACE to arm timer'}
              {timerState === TIMER_STATES.ARMED && 'Release to begin WCA inspection'}
              {timerState === TIMER_STATES.INSPECTION && `${inspectionTimeLeft}s inspection remaining`}
              {timerState === TIMER_STATES.RUNNING && 'Press SPACE to stop the timer'}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SolvesCard
          title="Your Solves"
          solves={mySolves}
          formatTime={formatTime}
          currentRound={currentRound}
        />
        <SolvesCard
          title={`${opponent?.name || 'Opponent'}'s Solves`}
          solves={opponentSolves}
          formatTime={formatTime}
          currentRound={currentRound}
        />
      </div>
    </div>
  );
}

function SolvesCard({ title, solves, formatTime, currentRound }) {
  const displayedSolves = solves.slice(0, 5);
  const avg = ResultCalculator.calculateAo5(solves);

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">{title}</h3>
        {avg && <span className="text-xs text-zinc-500">Avg: {formatTime(avg)}</span>}
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((index) => {
          const solve = displayedSolves.find(s => s.scrambleIndex === index);
          return (
            <div key={index} className="flex justify-between items-center">
              <span className="text-zinc-600 text-xs">{index + 1}.</span>
              <span className={`text-sm font-mono ${
                solve ? 'text-white' : 'text-zinc-700'
              }`}>
                {solve ? ResultCalculator.getSolveWithPenalty(solve) : '---'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getTimeMsValue(time, penalty) {
  if (!time) return 0;
  let ms = time;
  if (penalty === '+2') ms += 2000;
  return ms;
}
