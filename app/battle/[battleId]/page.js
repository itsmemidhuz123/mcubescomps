'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Loader2, Sword, Trophy, Crown, ArrowLeft, RefreshCw, Eye, Clock } from 'lucide-react';
import { useBattle, submitSolve } from '../../../hooks/useBattle';
import { useBattleTimer } from '../../../hooks/useBattleTimer';
import { BATTLE_STATES, formatBattleTime, PENALTY, TOTAL_SCRAMBLES, MAX_SOLVE_TIME_MS } from '../../../lib/battleUtils';
import { TIMER_STATES } from '../../../hooks/useTimerEngine';

export default function BattleRoomPage() {
  const { battleId } = useParams();
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [battleData, setBattleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [countdownActive, setCountdownActive] = useState(false);
  const [cheatFlags, setCheatFlags] = useState([]);

  const {
    battle,
    player1Solves,
    player2Solves,
    loading: battleLoading,
    getMySolves,
    getOpponentSolves,
    getCurrentScramble,
    canViewNextScramble,
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
    getFinalTime,
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

  useEffect(() => {
    if (battle?.status === 'countdown' && !countdownActive) {
      setCountdown(5);
      setCountdownActive(true);
    }
  }, [battle?.status, countdownActive]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && countdownActive && battle?.status === 'countdown') {
      fetch('/api/battle/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battleId, uid: user?.uid }),
      }).then(() => {
        setCountdownActive(false);
      });
    }
  }, [countdown, countdownActive, battle, battleId, user]);

  useEffect(() => {
    if (battle?.status !== 'live' || timerState !== TIMER_STATES.RUNNING) return;

    const timeout = setTimeout(async () => {
      if (timerState === TIMER_STATES.RUNNING && battle?.status === 'live') {
        const mySolves = getMySolves();
        const expectedIndex = mySolves.length;
        
        try {
          await fetch('/api/battle/submit-solve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              battleId,
              uid: user.uid,
              time: MAX_SOLVE_TIME_MS,
              penalty: -1,
              scrambleIndex: expectedIndex,
              reason: 'TIMEOUT_DNF',
            }),
          });
          reset();
        } catch (e) {
          console.error('Auto DNF failed:', e);
        }
      }
    }, MAX_SOLVE_TIME_MS);

    return () => clearTimeout(timeout);
  }, [battle?.status, timerState, battleId, user, getMySolves, reset]);

  useEffect(() => {
    if (battle?.status !== 'live') return;

    const handleVisibilityChange = () => {
      if (document.hidden && timerState === TIMER_STATES.RUNNING) {
        setCheatFlags(prev => [...prev, { type: 'TAB_SWITCH', timestamp: Date.now() }]);
      }
    };

    const handleBlur = () => {
      if (timerState === TIMER_STATES.RUNNING) {
        setCheatFlags(prev => [...prev, { type: 'WINDOW_BLUR', timestamp: Date.now() }]);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [battle?.status, timerState]);

  useEffect(() => {
    if (timerState === TIMER_STATES.STOPPED && time > 0 && time < 2000) {
      setCheatFlags(prev => [...prev, { type: 'FAST_SOLVE', time, timestamp: Date.now() }]);
    }
  }, [timerState, time]);

  const handleSubmitSolve = async () => {
    if (!user || !battle) return;
    if (timerState !== TIMER_STATES.STOPPED) return;
    
    const mySolves = getMySolves();
    const expectedIndex = mySolves.length;
    
    if (!canSubmitSolve(expectedIndex)) {
      alert('Cannot submit solve at this time');
      return;
    }

    const solveData = submitCurrentSolve();
    
    if (!solveData.valid || solveData.time === null || solveData.time === undefined) {
      alert('Please complete a valid solve before submitting');
      return;
    }

    if (solveData.time < 100) {
      alert('Time too short - please complete a valid solve');
      return;
    }

    const currentFlags = cheatFlags.filter(f => f.timestamp > Date.now() - 60000);
    
    setSubmitting(true);
    try {
      const response = await fetch('/api/battle/submit-solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          battleId,
          uid: user.uid,
          time: solveData.time,
          penalty: solveData.penalty,
          scrambleIndex: expectedIndex,
          flags: currentFlags,
        }),
      });

      const result = await response.json();
      
      if (!result.success) {
        alert(result.message || 'Failed to submit solve');
        return;
      }

      setCheatFlags([]);
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

  const handleJoinAsOpponent = async () => {
    if (!user || !battle) return;

    try {
      const response = await fetch('/api/battle/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          battleId,
          userId: user.uid,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/battle/${battleId}`);
      } else {
        alert(data.message || 'Failed to join battle');
      }
    } catch (error) {
      console.error('Join battle error:', error);
      alert('Failed to join battle');
    }
  };

  const isPlayer1 = battle?.player1 === user?.uid;
  const isPlayer2 = battle?.player2 === user?.uid;
  const isCreator = battle?.createdBy === user?.uid;
  const isParticipant = isPlayer1 || isPlayer2;
  const isSpectator = !isParticipant && battle?.allowSpectators === true;

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

  if (countdown > 0) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-12 text-center">
            <div className="text-8xl font-bold text-yellow-400 mb-4">{countdown}</div>
            <h2 className="text-2xl font-bold text-white">Get Ready!</h2>
            <p className="text-zinc-400 mt-2">Battle starting soon...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isParticipant && !isSpectator) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="bg-zinc-900 border-zinc-800 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Eye className="w-12 h-12 mx-auto mb-4 text-zinc-400" />
            <h2 className="text-xl font-bold mb-2">Visitor Mode</h2>
            <p className="text-zinc-400 mb-4">
              Spectators are not allowed for this battle.
            </p>
            <div className="flex flex-col gap-3">
              <Button onClick={() => router.push('/battle')}>
                Back to Battles
              </Button>
              {battle.status === 'waiting' && (
                <Button 
                  onClick={handleJoinAsOpponent}
                  className="bg-green-600 hover:bg-green-500 w-full"
                >
                  Join as Opponent
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSpectator && battle.status === 'waiting') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="bg-zinc-900 border-zinc-800 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Eye className="w-12 h-12 mx-auto mb-4 text-zinc-400" />
            <h2 className="text-xl font-bold mb-2">Visitor Mode</h2>
            <p className="text-zinc-400 mb-4">
              You are watching this battle
            </p>
            {battle.player1 && battle.player2 === null && (
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={handleJoinAsOpponent}
                  className="bg-green-600 hover:bg-green-500 w-full"
                >
                  Join as Opponent
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/battle')}
                  className="w-full"
                >
                  Leave and Browse Battles
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (battle.status === 'expired') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="bg-zinc-900 border-zinc-800 max-w-md">
          <CardContent className="p-8 text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 text-zinc-400" />
            <h2 className="text-xl font-bold mb-2">Battle Expired</h2>
            <p className="text-zinc-400 mb-4">
              This battle has expired due to inactivity.
            </p>
            <Button onClick={() => router.push('/battle')}>
              Back to Battles
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (battle.status === 'expired') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="bg-zinc-900 border-zinc-800 max-w-md">
          <CardContent className="p-8 text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 text-zinc-400" />
            <h2 className="text-xl font-bold mb-2">Battle Expired</h2>
            <p className="text-zinc-400 mb-4">
              This battle has expired due to inactivity.
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
    const myBestValue = myBestSingle();
    const opponentBestValue = opponentBestSingle();
    const iWon = battle.winner === user?.uid;
    const isTie = battle.winner === 'tie';
    const scores = battle.scores || { player1: 0, player2: 0 };
    const myScore = isPlayer1 ? scores.player1 : scores.player2;
    const opponentScore = isPlayer1 ? scores.player2 : scores.player1;

    const handleRematch = async () => {
      if (!isCreator) {
        alert('Only the creator can start a rematch');
        return;
      }

      try {
        const response = await fetch('/api/battle/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            event: battle.event,
            roundCount: battle.roundCount,
            format: battle.format,
            winsRequired: battle.winsRequired,
          }),
        });
        const data = await response.json();
        if (data.success) {
          router.push(`/battle/${data.battleId}`);
        } else {
          alert(data.message || 'Failed to create rematch');
        }
      } catch (e) {
        alert('Failed to create rematch');
      }
    };

    const handleShare = async () => {
      const resultText = `🏆 Battle Results - ${getCurrentEventName()}
${iWon ? '🎉 You Won!' : isTie ? '🤝 It\'s a Tie!' : '😢 You Lost'}
Score: ${myScore} - ${opponentScore}
Your Ao5: ${formatBattleTime(myAo5Value) || 'DNF'}
Best Single: ${formatBattleTime(myBestValue) || 'DNF'}

Play at: ${typeof window !== 'undefined' ? window.location.origin : 'mcubesarena.com'}`;

      if (navigator.share) {
        try {
          await navigator.share({ text: resultText });
        } catch (e) {
          navigator.clipboard.writeText(resultText);
          alert('Result copied to clipboard!');
        }
      } else {
        navigator.clipboard.writeText(resultText);
        alert('Result copied to clipboard!');
      }
    };

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="bg-zinc-900 border-zinc-800 max-w-2xl w-full">
          <CardContent className="p-8 text-center">
            {isTie ? (
              <>
                <Trophy className="w-20 h-20 mx-auto mb-4 text-yellow-500" />
                <h2 className="text-4xl font-bold mb-2">It&apos;s a Tie!</h2>
              </>
            ) : iWon ? (
              <>
                <Crown className="w-20 h-20 mx-auto mb-4 text-yellow-500" />
                <h2 className="text-4xl font-bold mb-2 text-yellow-500">You Win!</h2>
              </>
            ) : (
              <>
                <Sword className="w-20 h-20 mx-auto mb-4 text-red-500" />
                <h2 className="text-4xl font-bold mb-2 text-red-500">You Lost!</h2>
              </>
            )}
            
            <div className="flex items-center justify-center gap-4 mt-4 mb-6">
              <div className="text-4xl font-bold text-green-400">{myScore}</div>
              <span className="text-2xl text-zinc-500">-</span>
              <div className="text-4xl font-bold text-blue-400">{opponentScore}</div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-zinc-800 rounded-lg p-4">
                <div className="text-sm text-zinc-400">Your Ao5</div>
                <div className="text-2xl font-bold text-green-400">
                  {formatBattleTime(myAo5Value) || 'DNF'}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  Best: {formatBattleTime(myBestValue) || 'DNF'}
                </div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4">
                <div className="text-sm text-zinc-400">Opponent Ao5</div>
                <div className="text-2xl font-bold text-blue-400">
                  {formatBattleTime(opponentAo5Value) || 'DNF'}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  Best: {formatBattleTime(opponentBestValue) || 'DNF'}
                </div>
              </div>
            </div>

            <div className="mb-6">
              <div className="text-sm text-zinc-400 mb-2">Solve Comparison</div>
              <div className="bg-zinc-800 rounded-lg p-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-500">
                      <th className="py-1">#</th>
                      <th className="py-1 text-green-400">You</th>
                      <th className="py-1 text-blue-400">Opponent</th>
                      <th className="py-1">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mySolves.map((solve, i) => {
                      const oppSolve = opponentSolves[i];
                      const myTime = solve.penalty === PENALTY.DNF ? 'DNF' : formatBattleTime(solve.time);
                      const oppTime = oppSolve?.penalty === PENALTY.DNF ? 'DNF' : formatBattleTime(oppSolve?.time);
                      let result = '';
                      if (solve.penalty === PENALTY.DNF && (!oppSolve || oppSolve.penalty === PENALTY.DNF)) result = 'Tie';
                      else if (solve.penalty === PENALTY.DNF) result = 'Lost';
                      else if (!oppSolve || oppSolve.penalty === PENALTY.DNF) result = 'Won';
                      else if (solve.time < oppSolve.time) result = 'Won';
                      else if (solve.time > oppSolve.time) result = 'Lost';
                      else result = 'Tie';
                      return (
                        <tr key={i} className="border-t border-zinc-700">
                          <td className="py-1 text-zinc-500">{i + 1}</td>
                          <td className="py-1 text-green-400">{myTime}</td>
                          <td className="py-1 text-blue-400">{oppTime || '-'}</td>
                          <td className={`py-1 ${result === 'Won' ? 'text-green-400' : result === 'Lost' ? 'text-red-400' : 'text-zinc-400'}`}>{result}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3">
              {isCreator && (
                <Button
                  onClick={handleRematch}
                  className="flex-1 bg-green-600 hover:bg-green-500"
                  size="lg"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Rematch
                </Button>
              )}
              {isPlayer1 && (
                <Button
                  onClick={handleShare}
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  Share Result
                </Button>
              )}
              <Button
                onClick={() => router.push('/battle')}
                variant="ghost"
                className="mt-4 w-full"
              >
                Back to Battles
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (battle.status === BATTLE_STATES.WAITING && isCreator) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="bg-zinc-900 border-zinc-800 max-w-md">
          <CardContent className="p-8 text-center">
            <RefreshCw className="w-12 h-12 mx-auto mb-4 text-zinc-400 animate-spin" />
            <h2 className="text-xl font-bold mb-2">Battle Created</h2>
            <p className="text-zinc-400 mb-4">
              Share this link with your opponent:
            </p>
            <div className="bg-zinc-800 rounded-lg p-3 mb-4">
              <code className="text-sm break-all">
                {typeof window !== 'undefined' ? window.location.href : ''}
              </code>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                }}
                className="w-full"
              >
                Copy Link
              </Button>
              <Button
                onClick={handleJoinAsOpponent}
                variant="outline"
                className="w-full"
              >
                Rejoin as Opponent
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (battle.status === BATTLE_STATES.WAITING && isPlayer2) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="bg-zinc-900 border-zinc-800 max-w-md">
          <CardContent className="p-8 text-center">
            <RefreshCw className="w-12 h-12 mx-auto mb-4 text-zinc-400 animate-spin" />
            <h2 className="text-xl font-bold mb-2">Waiting for Creator</h2>
            <p className="text-zinc-400 mb-4">
              Battle will start when creator joins.
            </p>
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleJoinAsOpponent}
                className="w-full"
              >
                Rejoin Battle
              </Button>
              <Button
                onClick={() => router.push('/battle')}
                variant="outline"
                className="w-full"
              >
                Back to Lobby
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canSolve = isMyTurn() && mySolves.length < TOTAL_SCRAMBLES;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {isSpectator && (
        <div className="bg-yellow-500/20 border-b border-yellow-500/30 py-2 px-4 text-center">
          <span className="text-yellow-400 font-medium flex items-center justify-center gap-2">
            <Eye className="w-4 h-4" />
            Spectator Mode - You are watching this battle
          </span>
        </div>
      )}
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
                {battle.battleName || 'Battle'}
              </h1>
              <p className="text-sm text-zinc-400">
                {getCurrentEventName()} • Round {Math.min(currentScrambleIndex + 1, TOTAL_SCRAMBLES)}/{TOTAL_SCRAMBLES}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {battle.scores && (
              <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1 rounded-lg">
                <span className="text-green-400 font-bold">{battle.scores.player1 || 0}</span>
                <span className="text-zinc-400">-</span>
                <span className="text-blue-400 font-bold">{battle.scores.player2 || 0}</span>
              </div>
            )}
            <Badge variant={battle.status === 'live' ? 'default' : 'secondary'} className="bg-green-600">
              {battle.status === 'live' ? 'LIVE' : battle.status}
            </Badge>
          </div>
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
          {isSpectator ? (
            <CardContent className="p-8 text-center">
              <div className="text-zinc-400 mb-4">Waiting for players to solve...</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800 rounded-lg p-4">
                  <div className="text-sm text-zinc-400 mb-1">Player 1</div>
                  <div className="text-lg font-bold text-green-400">
                    {isPlayer1 ? (userProfile?.displayName || 'You') : 'Waiting...'}
                  </div>
                  <div className="text-sm text-zinc-500 mt-2">
                    Solves: {player1Solves?.length || 0}/{TOTAL_SCRAMBLES}
                  </div>
                </div>
                <div className="bg-zinc-800 rounded-lg p-4">
                  <div className="text-sm text-zinc-400 mb-1">Player 2</div>
                  <div className="text-lg font-bold text-blue-400">
                    {isPlayer2 ? (userProfile?.displayName || 'You') : 'Waiting...'}
                  </div>
                  <div className="text-sm text-zinc-500 mt-2">
                    Solves: {player2Solves?.length || 0}/{TOTAL_SCRAMBLES}
                  </div>
                </div>
              </div>
            </CardContent>
          ) : (
          <CardContent className="p-8">
            <div className="bg-zinc-800 rounded-lg p-4 mb-8 text-center">
              <div className="text-sm text-zinc-400 mb-2">Current Scramble</div>
              <div className="text-lg font-mono font-bold text-yellow-400 break-all">
                {currentScramble || 'Loading...'}
              </div>
            </div>

            <div className="text-center mb-8">
              <div className={`text-8xl font-bold font-mono tabular-nums ${
                timerState === TIMER_STATES.RUNNING ? 'text-green-400' :
                timerState === TIMER_STATES.STOPPED ? 'text-yellow-400' :
                timerState === TIMER_STATES.ARMED ? 'text-yellow-400' :
                'text-white'
              }`}>
                {timerState === TIMER_STATES.STOPPED 
                  ? formatBattleTime(getFinalTime())
                  : formatBattleTime(time)
                }
              </div>
              
              {timerState === TIMER_STATES.ARMED && (
                <div className="text-yellow-400 mt-2">Release to start</div>
              )}
            </div>

            {canSolve ? (
              <div className="flex flex-col items-center gap-4">
                {isSpectator ? (
                  <div className="text-center text-zinc-400 bg-zinc-800 rounded-lg p-4">
                    <p className="mb-2">Visitor Mode - Cannot interact with timer</p>
                    <Button variant="outline" onClick={() => router.push('/battle')}>
                      Leave Battle
                    </Button>
                  </div>
                ) : (
                  <>
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
                  </>
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
          )}
        </Card>

        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-sm text-zinc-400 mb-2">Your Solves</div>
              <div className="space-y-2">
                {(Array.isArray(mySolves) ? mySolves : []).map((solve, i) => {
                  const isDNF = solve.penalty === PENALTY.DNF;
                  const isValidTime = typeof solve.time === 'number' && solve.time >= 0;
                  return (
                    <div key={i} className="flex justify-between">
                      <span className="text-zinc-500">#{i + 1}</span>
                      <span className={`font-mono ${
                        isDNF ? 'text-red-400' : 'text-white'
                      }`}>
                        {!isValidTime 
                          ? '--' 
                          : isDNF 
                            ? 'DNF' 
                            : formatBattleTime(solve.time + (solve.penalty * 1000))
                        }
                      </span>
                    </div>
                  );
                })}
                                {[...(Array.isArray(mySolves) && mySolves.length < TOTAL_SCRAMBLES ? Array(TOTAL_SCRAMBLES - mySolves.length) : [])].map((_, i) => (
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
                {(Array.isArray(opponentSolves) ? opponentSolves : []).map((solve, i) => {
                  const isDNF = solve.penalty === PENALTY.DNF;
                  const isValidTime = typeof solve.time === 'number' && solve.time >= 0;
                  return (
                    <div key={i} className="flex justify-between">
                      <span className="text-zinc-500">#{i + 1}</span>
                      <span className={`font-mono ${
                        isDNF ? 'text-red-400' : 'text-white'
                      }`}>
                        {!isValidTime 
                          ? '--' 
                          : isDNF 
                            ? 'DNF' 
                            : formatBattleTime(solve.time + (solve.penalty * 1000))
                        }
                      </span>
                    </div>
                  );
                })}
                                {[...(Array.isArray(opponentSolves) && opponentSolves.length < TOTAL_SCRAMBLES ? Array(TOTAL_SCRAMBLES - opponentSolves.length) : [])].map((_, i) => (
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
