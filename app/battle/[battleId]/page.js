'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { doc, getDoc, onSnapshot, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Loader2, Sword, Trophy, Crown, ArrowLeft, RefreshCw, Eye, Clock, Volume2, Image as ImageIcon, X } from 'lucide-react';
import { useBattle, submitSolve } from '../../../hooks/useBattle';
import { useBattleTimer } from '../../../hooks/useBattleTimer';
import { useBattleSounds, useBattleIntro } from '../../../hooks/useBattleSounds';
import { useBattleBan } from '../../../hooks/useBattleBan';
import { BATTLE_STATES, formatBattleTime, PENALTY, TOTAL_SCRAMBLES, MAX_SOLVE_TIME_MS } from '../../../lib/battleUtils';
import { TIMER_STATES } from '../../../hooks/useTimerEngine';

export default function BattleRoomPage() {
  const { battleId } = useParams();
  const searchParams = useSearchParams();
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { isBanned, banInfo, loading: banLoading } = useBattleBan(user?.uid);
  
  const watchMode = searchParams.get('watch') === 'true';
  
  const [battleData, setBattleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [countdownActive, setCountdownActive] = useState(false);
  const [cheatFlags, setCheatFlags] = useState([]);
  const [showIntro, setShowIntro] = useState(false);
  const [introDismissed, setIntroDismissed] = useState(false);
  
  // Match waiting state - when waiting for opponent to join
  const [isMatchWaiting, setIsMatchWaiting] = useState(false);
  const [matchData, setMatchData] = useState(null);
  
  // Rules modal state
  const [showRules, setShowRules] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const { playIntro, playCountdown, playBattleStart, playVictory, playDefeat } = useBattleSounds();
  const { shouldShowIntro, dismissIntro } = useBattleIntro();

  // Handle match waiting - when battleId is actually a matchId (starts with "match_" or "team_match_")
  useEffect(() => {
    if (authLoading || !user || !battleId) return;
    
    // Check if this is a match waiting (not a battle yet)
    const isQuickMatch = battleId.startsWith('match_');
    const isTeamMatch = battleId.startsWith('team_match_');
    
    if (!isQuickMatch && !isTeamMatch) return;
    
    setIsMatchWaiting(true);
    setLoading(true);
    
    // Listen to the match document
    const matchRef = doc(db, 'matches', battleId);
    const unsubscribe = onSnapshot(matchRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMatchData(data);
        
        // Check if this user is part of this match
        const players = data.players || [];
        const isParticipant = players.includes(user.uid) || 
                             data.player1 === user.uid || 
                             data.player2 === user.uid;
        
        if (!isParticipant) {
          setError('You are not part of this match');
          setLoading(false);
          return;
        }
        
        // Mark this player as joined if not already
        const playersJoined = data.playersJoined || [];
        if (!playersJoined.includes(user.uid)) {
          await updateDoc(matchRef, {
            playersJoined: [...playersJoined, user.uid],
            [`${user.uid}JoinedAt`]: new Date(),
          });
        }
        
        // Check if battle can be created (need at least 2 players for quick match, or 2+ for team)
        const minPlayers = isTeamMatch ? 2 : 2;
        const canStart = playersJoined.length >= minPlayers;
        
        // First check if battle already exists in match document (from another player)
        if (data.battleCreated && data.battleId) {
          router.replace(`/battle/${data.battleId}`);
          return;
        }
        
        if (canStart && !data.battleCreated) {
          // Enough players joined - create the battle
          // Use consistent player data from the match document
          const player1Name = data.player1Name || data.player1Username || 'Player 1';
          const player2Name = data.player2Name || data.player2Username || 'Player 2';
          
          try {
            const apiEndpoint = isTeamMatch 
              ? '/api/battle/team-match/create-battle'
              : '/api/battle/quick-match/create-battle';
            
            const response = await fetch(apiEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                matchId: battleId,
                ...(isTeamMatch ? {} : {
                  player1: data.player1,
                  player2: data.player2,
                  player1Name: player1Name,
                  player2Name: player2Name,
                }),
              }),
            });
            
            const result = await response.json();
            
            if (result.success && result.battleId) {
              try {
                await updateDoc(matchRef, {
                  battleCreated: true,
                  battleId: result.battleId,
                });
              } catch (e) {
                console.log('Match already processed by another player');
              }
              
              router.replace(`/battle/${result.battleId}`);
            }
          } catch (err) {
            console.error('Failed to create battle:', err);
          }
        }
        
        // If battle already created, redirect to it
        if (data.battleCreated && data.battleId) {
          router.replace(`/battle/${data.battleId}`);
        }
      } else {
        setError('Match not found');
        setLoading(false);
      }
    }, (err) => {
      console.error('Match listener error:', err);
      setError('Failed to join match');
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [battleId, user, authLoading, router]);

  // Check if rules should be shown for this battle type

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
    handleTouchStart,
    handleTouchEnd,
    reset,
    submitCurrentSolve,
    getFinalTime,
  } = useBattleTimer({ inspectionEnabled: true });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirect=/battle/' + battleId);
    }
  }, [authLoading, user, router, battleId]);

  // Mark player as joined when they visit the battle
  useEffect(() => {
    if (!battle || !user || battle.status !== 'waiting') return;
    
    const isPlayer1 = battle.player1 === user.uid;
    const isPlayer2 = battle.player2 === user.uid;
    
    if (!isPlayer1 && !isPlayer2) return;
    
    // Check if this player has already joined
    const hasJoined = isPlayer1 ? battle.creatorJoined : battle.opponentJoined;
    
    if (!hasJoined) {
      const battleRef = doc(db, 'battles', battleId);
      const updateData = isPlayer1 
        ? { creatorJoined: true }
        : { opponentJoined: true };
      
      // If this is a quick match (battleType: matchmaking), also update status to countdown
      if (battle.battleType === 'matchmaking') {
        updateData.status = 'waiting';
      }
      
      updateDoc(battleRef, updateData).catch(console.error);
    }
  }, [battle, user, battleId]);

  // Auto-join as spectator when visiting with ?watch=true
  useEffect(() => {
    if (!battle || !user || !watchMode) return;
    
    const spectators = battle.spectators || [];
    if (!spectators.includes(user.uid)) {
      const battleRef = doc(db, 'battles', battleId);
      updateDoc(battleRef, {
        spectators: arrayUnion(user.uid)
      }).catch(console.error);
    }
  }, [battle, user, watchMode, battleId]);

  // Remove from spectators on unmount
  useEffect(() => {
    return () => {
      if (user && battleId && watchMode) {
        const battleRef = doc(db, 'battles', battleId);
        updateDoc(battleRef, {
          spectators: arrayRemove ? arrayRemove(user.uid) : []
        }).catch(console.error);
      }
    };
  }, [user, battleId, watchMode]);

  useEffect(() => {
    if (battle && user && !introDismissed) {
      const shouldShow = shouldShowIntro();
      setShowIntro(shouldShow);
      if (shouldShow) {
        playIntro();
      }
    }
  }, [battle, user, introDismissed, shouldShowIntro, playIntro]);

  const handleDismissIntro = () => {
    dismissIntro();
    setShowIntro(false);
    setIntroDismissed(true);
  };

  // Play victory/defeat sounds when battle completes
  useEffect(() => {
    if (battle?.status === 'completed' && battle.winner && user) {
      const iWon = battle.winner === user.uid;
      const isTie = battle.winner === 'tie';
      
      if (iWon && !isTie) {
        playVictory();
      } else if (!iWon && !isTie) {
        playDefeat();
      }
    }
  }, [battle?.status, battle?.winner, user, playVictory, playDefeat]);

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
    if (!battle || battle.status !== 'live') return;
    
    // Check if rules should be shown for this battle type
    const battleType = battle.battleType || 'custom';
    const rulesKey = `showRules_${battleType}`;
    const hasAcknowledged = localStorage.getItem(rulesKey);
    
    if (!hasAcknowledged) {
      setShowRules(true);
    }
  }, [battle]);

  // Start countdown only after rules acknowledged
  useEffect(() => {
    if (showRules) return; // Don't start countdown if rules showing
    if (battle?.status === 'waiting' && battle?.creatorJoined && battle?.opponentJoined && !countdownActive) {
      setCountdown(5);
      setCountdownActive(true);
    }
  }, [battle?.status, battle?.creatorJoined, battle?.opponentJoined, countdownActive, showRules]);

  useEffect(() => {
    if (countdown > 0) {
      playCountdown(countdown);
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && countdownActive && battle?.status === 'waiting' && battle?.creatorJoined && battle?.opponentJoined) {
      playBattleStart();
      fetch('/api/battle/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battleId, uid: user?.uid }),
      }).then(() => {
        setCountdownActive(false);
      });
    }
  }, [countdown, countdownActive, battle, battleId, user, playCountdown, playBattleStart]);

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
    const handleKeyPress = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        handleAction();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleAction]);


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
  const isSpectator = watchMode || (!isParticipant && battle?.allowSpectators === true);
  const isTeamBattle = battle?.teamSize && battle?.teamSize > 1;

  const spectatorCount = battle?.spectators?.length || 0;

  const mySolves = getMySolves();
  const opponentSolves = getOpponentSolves();

  const currentScramble = getCurrentScramble();
  const currentScrambleIndex = battle?.currentScrambleIndex || 0;

  const getTeamMemberName = (playerId) => {
    if (!playerId) return 'Player ?';
    if (playerId === user?.uid) return userProfile?.displayName || 'You';
    if (battle?.player1 === playerId) return battle?.player1Name || 'Player 1';
    if (battle?.player2 === playerId) return battle?.player2Name || 'Player 2';
    if (battle?.teamA?.includes(playerId)) return battle?.teamA?.find(p => p === playerId)?.name || `Team A ${battle?.teamA?.indexOf(playerId) + 1}`;
    if (battle?.teamB?.includes(playerId)) return battle?.teamB?.find(p => p === playerId)?.name || `Team B ${battle?.teamB?.indexOf(playerId) + 1}`;
    return 'Player ?';
  };

  const getMyTeam = () => {
    if (!isTeamBattle) return null;
    if (isPlayer1) return 'teamA';
    if (isPlayer2) return 'teamB';
    return null;
  };

  const getMyTeamName = () => {
    const myTeam = getMyTeam();
    if (myTeam === 'teamA') return 'Team A';
    if (myTeam === 'teamB') return 'Team B';
    return '';
  };

  const getOpponentTeamName = () => {
    if (!isTeamBattle) return '';
    const myTeam = getMyTeam();
    if (myTeam === 'teamA') return 'Team B';
    if (myTeam === 'teamB') return 'Team A';
    return '';
  };

  const getTeamMembers = (teamKey) => {
    if (!isTeamBattle) return [];
    const team = battle?.[teamKey];
    return team?.map(uid => {
      let name = 'Player ?';
      let nameOverride = null;
      
      if (uid === user?.uid) {
        name = userProfile?.displayName || 'You';
      } else if (battle?.player1 === uid) {
        name = battle?.player1Name || 'Player 1';
      } else if (battle?.player2 === uid) {
        name = battle?.player2Name || 'Player 2';
      } else if (uid?.name) {
        name = uid.name;
      } else if (uid?.displayName) {
        name = uid.displayName;
      }
      
      return { uid, name, nameOverride };
    }) || [];
  };

  const getTeamSolvesForMember = (playerId) => {
    const allSolves = mySolves.concat(opponentSolves);
    return allSolves.filter(solve => solve.uid === playerId);
  };

  // Show ban message if user is banned
  if (!banLoading && isBanned && banInfo) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="bg-zinc-900 border-red-800 w-full max-w-lg">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-900/30 flex items-center justify-center">
              <X className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-red-400 mb-4">Account Restricted</h2>
            <p className="text-zinc-400 mb-4">
              You are restricted from participating in battles.
            </p>
            <div className="bg-zinc-800 rounded-lg p-4 mb-4 text-left">
              <p className="text-sm text-zinc-400 mb-2"><span className="text-zinc-500">Reason:</span> {banInfo.reason}</p>
              {banInfo.expiresAt && (
                <p className="text-sm text-zinc-400">
                  <span className="text-zinc-500">Expires:</span> {banInfo.expiresAt.toLocaleDateString()}
                </p>
              )}
            </div>
            <Button
              onClick={() => window.location.href = 'mailto:hellobugsentertainment@gmail.com?subject=Battle%20Ban%20Appeal'}
              className="w-full bg-red-600 hover:bg-red-500"
            >
              Contact Admin for Clarification
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authLoading || battleLoading || !battle) {
    // Show match waiting screen if waiting for players to join
    if (isMatchWaiting && matchData) {
      const isTeamMatch = matchData.battleType === 'teamBattle';
      const playersJoined = matchData.playersJoined || [];
      const players = matchData.players || [];
      const teamA = matchData.teamA || [];
      const teamB = matchData.teamB || [];
      
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <Card className="bg-zinc-900 border-zinc-800 w-full max-w-4xl">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <Loader2 className="w-12 h-12 mx-auto mb-4 text-yellow-500 animate-spin" />
                <h2 className="text-2xl font-bold text-white mb-2">
                  {isTeamMatch ? 'Team Battle' : 'Quick Battle'}
                </h2>
                <p className="text-zinc-400">
                  Waiting for players to join...
                </p>
              </div>

              {/* Live Team Display */}
              {isTeamMatch && (
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  {/* Team A */}
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <div className="text-lg font-bold text-green-400 mb-3 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-sm">A</span>
                      Team A
                    </div>
                    <div className="space-y-2">
                      {teamA.map((playerId, idx) => {
                        const hasJoined = playersJoined.includes(playerId);
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${hasJoined ? 'bg-green-500' : 'bg-zinc-600'}`} />
                            <span className={`text-sm ${hasJoined ? 'text-white' : 'text-zinc-500'}`}>
                              {playerId === user?.uid ? 'You' : `Player ${idx + 1}`}
                              {hasJoined ? ' ✓' : ' (waiting...)'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Team B */}
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <div className="text-lg font-bold text-blue-400 mb-3 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm">B</span>
                      Team B
                    </div>
                    <div className="space-y-2">
                      {teamB.map((playerId, idx) => {
                        const hasJoined = playersJoined.includes(playerId);
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${hasJoined ? 'bg-blue-500' : 'bg-zinc-600'}`} />
                            <span className={`text-sm ${hasJoined ? 'text-white' : 'text-zinc-500'}`}>
                              {playerId === user?.uid ? 'You' : `Player ${idx + 1}`}
                              {hasJoined ? ' ✓' : ' (waiting...)'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Match Waiting */}
              {!isTeamMatch && (
                <div className="bg-zinc-800 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${playersJoined.includes(matchData.player1) ? 'bg-green-500' : 'bg-zinc-600'}`} />
                      <span className="text-white">
                        {matchData.player1 === user?.uid ? 'You' : matchData.player1Name || 'Player 1'}
                        {playersJoined.includes(matchData.player1) ? ' ✓' : ''}
                      </span>
                    </div>
                    <span className="text-zinc-500">vs</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white">
                        {matchData.player2 === user?.uid ? 'You' : matchData.player2Name || 'Player 2'}
                        {playersJoined.includes(matchData.player2) ? ' ✓' : ''}
                      </span>
                      <div className={`w-3 h-3 rounded-full ${playersJoined.includes(matchData.player2) ? 'bg-green-500' : 'bg-zinc-600'}`} />
                    </div>
                  </div>
                </div>
              )}

              {/* Players joined count */}
              <div className="text-center text-zinc-400 text-sm">
                {playersJoined.length} / {players.length} players joined
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (showIntro) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="bg-zinc-900 border-zinc-800 w-full">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <Volume2 className="w-8 h-8 text-red-500" />
              <h2 className="text-2xl font-bold">Welcome to MCubes Arena Battle Mode</h2>
            </div>
            
            <div className="text-zinc-300 space-y-4 text-sm leading-relaxed">
              <p>In battle mode, you compete head-to-head against another cuber using the same scramble. Both players will receive identical scrambles for each round to ensure a fair competition.</p>
              
              <p>Before every solve, you will have a short inspection period to examine the scramble. When the countdown finishes, start your solve and complete the cube as fast as possible.</p>
              
              <p>The player with the fastest valid solve wins the round. If a solve receives a plus two penalty or a DNF, the penalty will automatically affect the round result.</p>
              
              <p>Both players must complete their solve before the next scramble is revealed. Once both results are submitted, the system will automatically move to the next round.</p>
              
              <p>Battles are played in the selected format, such as best of five or first to three wins. The first player to win the required number of rounds wins the battle.</p>
              
              <p className="text-yellow-400 font-medium">Do not refresh the page or navigate away which leads to a penalty and you may be disqualified.</p>
              
              <p className="text-green-400 font-medium">Stay focused, solve fast, and enjoy the competition. Good luck!</p>
            </div>

            <div className="mt-8 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input 
                  type="checkbox" 
                  onChange={(e) => {
                    if (e.target.checked) {
                      dismissIntro();
                    }
                  }}
                  className="w-4 h-4 rounded"
                />
                Don&apos;t show again
              </label>
              <Button 
                onClick={handleDismissIntro}
                className="bg-red-600 hover:bg-red-500"
                size="lg"
              >
                I&apos;m Ready! Let&apos;s Battle
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show rules modal before countdown
  if (showRules) {
    const battleType = battle?.battleType || 'custom';
    const rulesTitle = battleType === 'quickBattle' ? 'Quick Battle Rules' : 
                       battleType === 'teamBattle' ? 'Team Battle Rules' : 'Battle Rules';
    
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="bg-zinc-900 border-zinc-800 w-full max-w-xl">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-white mb-4">{rulesTitle}</h2>
            
            <div className="text-zinc-300 space-y-3 text-sm mb-6">
              <p>• {battle?.format === 'ao5' ? 'Best of 5 (Ao5)' : battle?.format === 'bo3' ? 'Best of 3' : battle?.format} format</p>
              <p>• 15-second inspection time per solve</p>
              <p>• +2 second penalty for inspection over 15 seconds</p>
              <p>• DNF if inspection exceeds 17 seconds</p>
              <p>• Tap/press space to start inspection</p>
              <p>• Tap/press again to start solve timer</p>
              <p>• Tap/press again to stop and submit</p>
            </div>

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-zinc-400 text-sm">Don&apos;t show again for {battleType}</span>
            </label>

            <Button
              onClick={() => {
                if (dontShowAgain) {
                  localStorage.setItem(`showRules_${battleType}`, 'true');
                }
                setShowRules(false);
              }}
              className="w-full bg-green-600 hover:bg-green-500"
              size="lg"
            >
              I Understand - Start Battle
            </Button>
          </CardContent>
        </Card>
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
        <Card className="bg-zinc-900 border-zinc-800 w-full">
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
        <Card className="bg-zinc-900 border-zinc-800 w-full">
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
        <Card className="bg-zinc-900 border-zinc-800 w-full">
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
      // Go to battle page and start a new quick match
      router.push('/battle');
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
        <Card className="bg-zinc-900 border-zinc-800 w-full">
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
              {battle.status === 'completed' && (
                <Button
                  onClick={handleRematch}
                  className="flex-1 bg-green-600 hover:bg-green-500"
                  size="lg"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Find New Match
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

  // Quick Match waiting screen - when battle is waiting for opponent to join
  const isQuickMatch = battle.battleType === 'matchmaking';
  const hasBothPlayers = battle.creatorJoined && battle.opponentJoined;
  
  if (battle.status === BATTLE_STATES.WAITING && isQuickMatch && !hasBothPlayers) {
    const isWaitingForOpponent = (isPlayer1 && !battle.opponentJoined) || (isPlayer2 && !battle.creatorJoined);
    
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="bg-zinc-900 border-zinc-800 w-full">
          <CardContent className="p-8 text-center">
            <RefreshCw className="w-12 h-12 mx-auto mb-4 text-yellow-500 animate-spin" />
            <h2 className="text-xl font-bold mb-2">
              {isWaitingForOpponent ? 'Waiting for Opponent...' : 'Opponent Joined!'}
            </h2>
            <p className="text-zinc-400 mb-4">
              {isWaitingForOpponent 
                ? 'Your opponent is connecting...' 
                : 'Battle starting soon...'}
            </p>
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className={`w-3 h-3 rounded-full ${battle.creatorJoined ? 'bg-green-500' : 'bg-zinc-500'}`} />
              <span className="text-sm text-zinc-400">Player 1</span>
              <span className="text-zinc-600">•</span>
              <div className={`w-3 h-3 rounded-full ${battle.opponentJoined ? 'bg-green-500' : 'bg-zinc-500'}`} />
              <span className="text-sm text-zinc-400">Player 2</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (battle.status === BATTLE_STATES.WAITING && isCreator) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="bg-zinc-900 border-zinc-800 w-full">
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
        <Card className="bg-zinc-900 border-zinc-800 w-full">
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
      <div className="max-w-full mx-auto p-4">
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
            {spectatorCount > 0 && (
              <div className="flex items-center gap-1 text-sm text-zinc-400">
                <Eye className="w-4 h-4" />
                <span>{spectatorCount} watching</span>
              </div>
            )}
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
           {isTeamBattle ? (
             <>
               <Card className="bg-zinc-900 border-zinc-800">
                 <CardContent className="p-4">
                   <div className="text-sm text-zinc-400 mb-2">{getMyTeamName()}</div>
                   {getTeamMembers('teamA').map((member, idx) => (
                     <div key={idx} className="flex items-center gap-2 mb-2">
                       {member.nameOverride?.photoURL && (
                         <img 
                           src={member.nameOverride.photoURL} 
                           alt={member.name}
                           className="w-8 h-8 rounded-full"
                         />
                       )}
                       <div className="flex-1">
                         <div className="text-sm font-medium">{member.name}</div>
                         <div className="text-xs text-zinc-500">
                           {getTeamSolvesForMember(member.uid).length}/{TOTAL_SCRAMBLES}
                         </div>
                       </div>
                     </div>
                   ))}
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
                   <div className="text-sm text-zinc-400 mb-2">{getOpponentTeamName()}</div>
                   {getTeamMembers('teamB').map((member, idx) => (
                     <div key={idx} className="flex items-center gap-2 mb-2">
                       {member.nameOverride?.photoURL && (
                         <img 
                           src={member.nameOverride.photoURL} 
                           alt={member.name}
                           className="w-8 h-8 rounded-full"
                         />
                       )}
                       <div className="flex-1">
                         <div className="text-sm font-medium">{member.name}</div>
                         <div className="text-xs text-zinc-500">
                           {getTeamSolvesForMember(member.uid).length}/{TOTAL_SCRAMBLES}
                         </div>
                       </div>
                     </div>
                   ))}
                 </CardContent>
               </Card>
             </>
           ) : (
             <>
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
             </>
           )}
         </div>

        <Card className="bg-zinc-900 border-zinc-800 mb-6">
           {isSpectator ? (
             <CardContent className="p-8 text-center">
               {isTeamBattle ? (
                 <div className="text-zinc-400 mb-4">Waiting for teams to solve...</div>
               ) : (
                 <div className="text-zinc-400 mb-4">Waiting for players to solve...</div>
               )}
               {isTeamBattle ? (
                 <div className="grid grid-cols-2 gap-4">
                   <div className="bg-zinc-800 rounded-lg p-4">
                     <div className="text-sm text-zinc-400 mb-1">{getMyTeamName()}</div>
                     {getTeamMembers('teamA').map((member, idx) => (
                       <div key={idx} className="flex items-center gap-2 mb-2">
                         {member.nameOverride?.photoURL && (
                           <img 
                             src={member.nameOverride.photoURL} 
                             alt={member.name}
                             className="w-8 h-8 rounded-full"
                           />
                         )}
                         <div className="flex-1">
                           <div className="text-sm font-medium">{member.name}</div>
                           <div className="text-xs text-zinc-500">
                             {getTeamSolvesForMember(member.uid).length}/{TOTAL_SCRAMBLES}
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>
                   <div className="bg-zinc-800 rounded-lg p-4">
                     <div className="text-sm text-zinc-400 mb-1">{getOpponentTeamName()}</div>
                     {getTeamMembers('teamB').map((member, idx) => (
                       <div key={idx} className="flex items-center gap-2 mb-2">
                         {member.nameOverride?.photoURL && (
                           <img 
                             src={member.nameOverride.photoURL} 
                             alt={member.name}
                             className="w-8 h-8 rounded-full"
                           />
                         )}
                         <div className="flex-1">
                           <div className="text-sm font-medium">{member.name}</div>
                           <div className="text-xs text-zinc-500">
                             {getTeamSolvesForMember(member.uid).length}/{TOTAL_SCRAMBLES}
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               ) : (
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
               )}
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
                 timerState === TIMER_STATES.INSPECTION ? 'text-red-400' :
                 'text-white'
               }`}>
                 {timerState === TIMER_STATES.STOPPED 
                   ? formatBattleTime(getFinalTime())
                   : timerState === TIMER_STATES.INSPECTION
                   ? formatBattleTime(inspectionTimeLeft)
                   : formatBattleTime(time)
                 }
               </div>

               {timerState === TIMER_STATES.ARMED && (
                   <div className="text-yellow-400 mt-2 font-medium">Press Space to Start</div>
                )}
               {timerState === TIMER_STATES.INSPECTION && (
                 <div className="text-red-400 mt-2 font-medium">
                   {inspectionTimeLeft > 0 
                     ? `Inspection: ${Math.ceil(inspectionTimeLeft / 1000)}s - Press Space to Stop`
                     : 'Inspection over! Solving now - Press Space to Stop'}
                 </div>
               )}
                {timerState === TIMER_STATES.RUNNING && (
                  <div className="text-green-400 mt-2 font-medium">Tap or Press Space to Stop</div>
                )}
              </div>

              {/* Clickable timer area - entire container is tappable */}
              <div 
                onClick={canSolve && !isSpectator && timerState !== TIMER_STATES.STOPPED ? handleAction : undefined}
                onTouchStart={canSolve && !isSpectator && timerState !== TIMER_STATES.STOPPED ? handleTouchStart : undefined}
                onTouchEnd={canSolve && !isSpectator && timerState !== TIMER_STATES.STOPPED ? handleTouchEnd : undefined}
                className={`mt-6 p-8 rounded-xl cursor-pointer transition-all ${
                  canSolve && !isSpectator && timerState !== TIMER_STATES.STOPPED
                    ? timerState === TIMER_STATES.IDLE
                      ? 'bg-green-900/30 border-2 border-green-500 hover:bg-green-800/40'
                      : timerState === TIMER_STATES.INSPECTION
                      ? 'bg-red-900/20 hover:bg-red-900/30'
                      : timerState === TIMER_STATES.RUNNING
                      ? 'bg-red-900/30 border-2 border-red-500 hover:bg-red-800/40'
                    : 'bg-zinc-800'
                    : 'bg-zinc-800 cursor-not-allowed'
                }`}
              >
                <div className="text-center">
                  {timerState === TIMER_STATES.IDLE && (
                    <span className="text-green-400 font-medium">Press Space to Start</span>
                  )}
                  {timerState === TIMER_STATES.INSPECTION && (
                    <span className="text-red-400 font-medium">Press Space to Start Solving</span>
                  )}
                  {timerState === TIMER_STATES.RUNNING && (
                    <span className="text-red-400 font-medium">Press Space to Stop</span>
                  )}
                  {timerState === TIMER_STATES.STOPPED && (
                    <span className="text-yellow-400 font-medium">Solve Complete!</span>
                  )}
                </div>
              </div>

            {canSolve ? (
              <div className="flex flex-col items-center gap-4 mt-4">
                <div className="flex gap-3">
                  <Button
                    variant={penalty === '+2' ? 'default' : 'outline'}
                    onClick={() => setPenalty(penalty === '+2' ? 'none' : '+2')}
                    className={penalty === '+2' ? 'bg-yellow-600 hover:bg-yellow-500' : ''}
                    size="lg"
                  >
                    +2
                  </Button>
                  <Button
                    variant={penalty === 'DNF' ? 'default' : 'outline'}
                    onClick={() => setPenalty(penalty === 'DNF' ? 'none' : 'DNF')}
                    className={penalty === 'DNF' ? 'bg-red-600 hover:bg-red-500' : ''}
                    size="lg"
                  >
                    DNF
                  </Button>
                </div>

                {penalty !== 'none' && (
                  <div className="bg-zinc-800 rounded-lg p-4 flex gap-4">
                    <div>
                      <div className="text-sm text-zinc-400">Time</div>
                      <div className="text-2xl font-mono font-bold">
                        {formatBattleTime(getFinalTime())}
                      </div>
                    </div>
                    <div className="w-px bg-zinc-700" />
                    <div>
                      <div className="text-sm text-zinc-400">Penalty</div>
                      <div className={`text-2xl font-bold ${
                        penalty === '+2' ? 'text-yellow-400' :
                        penalty === 'DNF' ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {penalty}
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleSubmitSolve}
                  disabled={submitting}
                  className="bg-green-600 hover:bg-green-500 w-full"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Solve'
                  )}
                </Button>
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
