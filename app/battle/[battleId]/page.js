'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Loader2, Sword, Trophy, Crown, ArrowLeft, RefreshCw } from 'lucide-react';
import { useBattle, submitSolve } from '../../../hooks/useBattle';
import { useBattleTimer } from '../../../hooks/useBattleTimer';
import { BATTLE_STATES, formatBattleTime, PENALTY, TOTAL_SCRAMBLES } from '../../../lib/battleUtils';
import { TIMER_STATES } from '../../../hooks/useTimerEngine';

export default function BattleRoomPage() {
  const { battleId } = useParams();
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [battleData, setBattleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const {
    battle,
    player1Solves,
    player2Solves,
    loading: battleLoading,
    getMySolves,
    getOpponentSolves,
    getCurrentScramble,
    isMyTurn,
    canSubmitSolve,
    myAo5,
    opponentAo5,
    myBestSingle,
    opponentBestSingle,
  } = useBattle(battleId, user?.uid);

  const {
    timerState,
    time,
    inspectionTimeLeft,
    penalty,
    setPenalty,
    handleAction,
    reset,
    submitCurrentSolve,
  } = useBattleTimer({ inspectionEnabled: false });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirect=/battle/' + battleId);
    }
  }, [authLoading, user, router, battleId]);

  useEffect(() => {
    if (battle && user) {
      const mySolves = getMySolves();
      const expectedIndex = mySolves.length;
      
      if (expectedIndex >= TOTAL_SCRAMBLES) {
        reset();
      }
    }
  }, [battle, user, getMySolves, reset]);

  // Refresh Detection - Check for incomplete solves on page load
  useEffect(() => {
    if (!battle || !user || battle.status !== 'live') return;

    const storageKey = `battle_${battleId}_solve_${user.uid}`;
    const incompleteSolve = localStorage.getItem(storageKey);

    if (incompleteSolve) {
      try {
        const solveData = JSON.parse(incompleteSolve);
        
        // User had an incomplete solve - mark as DNF
        const mySolves = getMySolves();
        const expectedIndex = mySolves.length;

        fetch('/api/battle/submit-solve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            battleId,
            uid: user.uid,
            time: 0,
            penalty: PENALTY.DNF,
            scrambleIndex: expectedIndex,
            reason: 'PAGE_REFRESH_DNF',
          }),
        }).then(() => {
          localStorage.removeItem(storageKey);
        });
      } catch (e) {
        console.error('Error processing incomplete solve:', e);
        localStorage.removeItem(storageKey);
      }
    }
  }, [battle, user, battleId, getMySolves]);

  // Save incomplete solve to localStorage when timer starts
  useEffect(() => {
    if (!battle || !user || battle.status !== 'live') return;

    const storageKey = `battle_${battleId}_solve_${user.uid}`;
    
    if (timerState === TIMER_STATES.RUNNING || timerState === TIMER_STATES.STOPPED) {
      const mySolves = getMySolves();
      const currentIndex = mySolves.length;
      localStorage.setItem(storageKey, JSON.stringify({
        scrambleIndex: currentIndex,
        started: true,
        timestamp: Date.now(),
      }));
    } else if (timerState === TIMER_STATES.IDLE) {
      localStorage.removeItem(storageKey);
    }
  }, [timerState, battle, user, battleId, getMySolves]);

  const handleSubmitSolve = async () => {
    if (!user || !battle) return;
    if (timerState !== TIMER_STATES.STOPPED) return;
    
    const mySolves = getMySolves();
    const expectedIndex = mySolves.length;
    
    if (!canSubmitSolve(expectedIndex)) {
      alert('Cannot submit solve at this time');
      return;
    }

    setSubmitting(true);
    try {
      const solveData = submitCurrentSolve();
      
      await fetch('/api/battle/submit-solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          battleId,
          uid: user.uid,
          time: solveData.time,
          penalty: solveData.penalty,
          scrambleIndex: expectedIndex,
        }),
      });

      reset();
    } catch (error) {
      console.error('Submit solve error:', error);
      alert('Failed to submit solve');
    } finally {
      setSubmitting(false);
    }
  };

  const getCurrentEventName = () => {
    const events = { '333': '3x3', '222': '2x2', '444': '4x4' };
    return events[battle?.event] || '3x3';
  };

  const isPlayer1 = battle?.player1 === user?.uid;
  const isPlayer2 = battle?.player2 === user?.uid;
  const isParticipant = isPlayer1 || isPlayer2;

  const mySolves = getMySolves();
  const opponentSolves = getOpponentSolves();

  const currentScramble = getCurrentScramble();
  const currentScrambleIndex = battle?.currentScrambleIndex || 0;

  if (authLoading || battleLoading || !battle) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!isParticipant) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Card className="bg-zinc-900 border-zinc-800 max-w-md">
          <CardContent className="p-8 text-center">
            <Sword className="w-12 h-12 mx-auto mb-4 text-zinc-400" />
            <h2 className="text-xl font-bold mb-2">Not a Participant</h2>
            <p className="text-zinc-400 mb-4">
              You are not part of this battle.
            </p>
            <Button onClick={() => router.push('/battle')}>
              Back to Battles
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (battle.status === BATTLE_STATES.COMPLETED) {
    const myAo5Value = myAo5();
    const opponentAo5Value = opponentAo5();
    const iWon = battle.winner === user?.uid;
    const isTie = battle.winner === 'tie';

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="bg-zinc-900 border-zinc-800 max-w-lg w-full">
          <CardContent className="p-8 text-center">
            {isTie ? (
              <>
                <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
                <h2 className="text-3xl font-bold mb-2">It&apos;s a Tie!</h2>
              </>
            ) : iWon ? (
              <>
                <Crown className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
                <h2 className="text-3xl font-bold mb-2 text-yellow-500">You Win!</h2>
              </>
            ) : (
              <>
                <Sword className="w-16 h-16 mx-auto mb-4 text-red-500" />
                <h2 className="text-3xl font-bold mb-2 text-red-500">You Lost!</h2>
              </>
            )}
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-zinc-800 rounded-lg p-4">
                <div className="text-sm text-zinc-400">Your Ao5</div>
                <div className="text-2xl font-bold">
                  {formatBattleTime(myAo5Value)}
                </div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4">
                <div className="text-sm text-zinc-400">Opponent Ao5</div>
                <div className="text-2xl font-bold">
                  {formatBattleTime(opponentAo5Value)}
                </div>
              </div>
            </div>

            <Button
              onClick={() => router.push('/battle')}
              className="mt-6 w-full"
              size="lg"
            >
              Play Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (battle.status === BATTLE_STATES.WAITING && isPlayer1) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="bg-zinc-900 border-zinc-800 max-w-md">
          <CardContent className="p-8 text-center">
            <RefreshCw className="w-12 h-12 mx-auto mb-4 text-zinc-400 animate-spin" />
            <h2 className="text-xl font-bold mb-2">Waiting for Opponent</h2>
            <p className="text-zinc-400 mb-4">
              Share this link with your opponent:
            </p>
            <div className="bg-zinc-800 rounded-lg p-3 mb-4">
              <code className="text-sm break-all">
                {typeof window !== 'undefined' ? window.location.href : ''}
              </code>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
              }}
              className="w-full"
            >
              Copy Link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canSolve = isMyTurn() && mySolves.length < TOTAL_SCRAMBLES;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/battle')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Sword className="w-5 h-5 text-red-500" />
                Battle
              </h1>
              <p className="text-sm text-zinc-400">
                {getCurrentEventName()} • Round {Math.min(currentScrambleIndex + 1, TOTAL_SCRAMBLES)}/{TOTAL_SCRAMBLES}
              </p>
            </div>
          </div>
          <Badge variant={battle.status === 'live' ? 'default' : 'secondary'} className="bg-green-600">
            {battle.status === 'live' ? 'LIVE' : battle.status}
          </Badge>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-sm text-zinc-400 mb-1">You</div>
              <div className="text-lg font-bold">{userProfile?.displayName || 'Player'}</div>
              <div className="text-2xl font-mono mt-2 text-green-400">
                {formatBattleTime(myAo5()) || '--'}
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                Best: {formatBattleTime(myBestSingle()) || '--'}
              </div>
              <div className="text-sm mt-2">
                Solves: {mySolves.length}/{TOTAL_SCRAMBLES}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800 md:col-span-1">
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <div className="text-6xl font-mono font-bold my-4">
                {currentScrambleIndex + 1}/{TOTAL_SCRAMBLES}
              </div>
              <div className="text-xs text-zinc-400">
                Current Scramble
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-sm text-zinc-400 mb-1">Opponent</div>
              <div className="text-lg font-bold">Player {isPlayer1 ? '2' : '1'}</div>
              <div className="text-2xl font-mono mt-2 text-blue-400">
                {formatBattleTime(opponentAo5()) || '--'}
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                Best: {formatBattleTime(opponentBestSingle()) || '--'}
              </div>
              <div className="text-sm mt-2">
                Solves: {opponentSolves.length}/{TOTAL_SCRAMBLES}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-zinc-900 border-zinc-800 mb-6">
          <CardContent className="p-6 text-center">
            <div className="text-sm text-zinc-400 mb-2">Current Scramble</div>
            <div className="text-2xl md:text-3xl font-mono tracking-wider">
              {currentScramble}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className={`text-8xl font-bold font-mono tabular-nums ${
                timerState === TIMER_STATES.RUNNING ? 'text-green-400' :
                timerState === TIMER_STATES.STOPPED ? 'text-yellow-400' :
                timerState === TIMER_STATES.ARMED ? 'text-yellow-400' :
                'text-white'
              }`}>
                {timerState === TIMER_STATES.STOPPED 
                  ? formatBattleTime(submitCurrentSolve().time)
                  : formatBattleTime(time)
                }
              </div>
              
              {timerState === TIMER_STATES.ARMED && (
                <div className="text-yellow-400 mt-2">Release to start</div>
              )}
            </div>

            {canSolve ? (
              <div className="flex flex-col items-center gap-4">
                <Button
                  onClick={handleAction}
                  disabled={timerState === TIMER_STATES.STOPPED || submitting}
                  className={`w-48 h-16 text-xl ${
                    timerState === TIMER_STATES.IDLE || timerState === TIMER_STATES.ARMED
                      ? 'bg-green-600 hover:bg-green-500'
                      : timerState === TIMER_STATES.RUNNING
                      ? 'bg-red-600 hover:bg-red-500'
                      : 'bg-zinc-700'
                  }`}
                >
                  {timerState === TIMER_STATES.IDLE && 'Hold to Start'}
                  {timerState === TIMER_STATES.ARMED && 'Release'}
                  {timerState === TIMER_STATES.RUNNING && 'Stop'}
                  {timerState === TIMER_STATES.STOPPED && 'Solved!'}
                </Button>

                {timerState === TIMER_STATES.STOPPED && (
                  <div className="flex gap-4">
                    <Button
                      variant={penalty === '+2' ? 'default' : 'outline'}
                      onClick={() => setPenalty(penalty === '+2' ? 'none' : '+2')}
                      className={penalty === '+2' ? 'bg-yellow-600' : ''}
                    >
                      +2
                    </Button>
                    <Button
                      variant={penalty === 'DNF' ? 'default' : 'outline'}
                      onClick={() => setPenalty(penalty === 'DNF' ? 'none' : 'DNF')}
                      className={penalty === 'DNF' ? 'bg-red-600' : ''}
                    >
                      DNF
                    </Button>
                    <Button
                      onClick={handleSubmitSolve}
                      disabled={submitting}
                      className="bg-green-600 hover:bg-green-500"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Submit'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-zinc-400">
                {mySolves.length >= TOTAL_SCRAMBLES ? (
                  'All solves completed! Waiting for opponent...'
                ) : (
                  "Waiting for opponent..."
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-sm text-zinc-400 mb-2">Your Solves</div>
              <div className="space-y-2">
                {mySolves.map((solve, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-zinc-500">#{i + 1}</span>
                    <span className={`font-mono ${
                      solve.penalty === PENALTY.DNF ? 'text-red-400' : 'text-white'
                    }`}>
                      {solve.penalty === PENALTY.DNF 
                        ? 'DNF' 
                        : formatBattleTime(solve.time + (solve.penalty * 1000))
                      }
                    </span>
                  </div>
                ))}
                {[...Array(TOTAL_SCRAMBLES - mySolves.length)].map((_, i) => (
                  <div key={`empty-${i}`} className="flex justify-between">
                    <span className="text-zinc-500">#{mySolves.length + i + 1}</span>
                    <span className="text-zinc-600">--</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-sm text-zinc-400 mb-2">Opponent Solves</div>
              <div className="space-y-2">
                {opponentSolves.map((solve, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-zinc-500">#{i + 1}</span>
                    <span className={`font-mono ${
                      solve.penalty === PENALTY.DNF ? 'text-red-400' : 'text-white'
                    }`}>
                      {solve.penalty === PENALTY.DNF 
                        ? 'DNF' 
                        : formatBattleTime(solve.time + (solve.penalty * 1000))
                      }
                    </span>
                  </div>
                ))}
                {[...Array(TOTAL_SCRAMBLES - opponentSolves.length)].map((_, i) => (
                  <div key={`empty-${i}`} className="flex justify-between">
                    <span className="text-zinc-500">#{opponentSolves.length + i + 1}</span>
                    <span className="text-zinc-600">--</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
