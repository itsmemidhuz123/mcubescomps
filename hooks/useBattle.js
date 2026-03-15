"use client";

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BATTLE_STATES } from '@/lib/battleUtils';
import { BattleService } from '@/lib/battle/BattleService';
import { ResultCalculator } from '@/lib/battle/ResultCalculator';

export function useBattle(battleId, user) {
  const [battle, setBattle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(null);

  const playerRole = battle ? BattleService.getPlayerRole(battle, user?.uid) : null;
  const opponent = battle ? {
    role: playerRole === 'player1' ? 'player2' : playerRole === 'player2' ? 'player1' : null,
    name: playerRole === 'player1' ? battle.player2Name : battle.player1Name,
    uid: playerRole === 'player1' ? battle.player2 : battle.player1,
    photoURL: playerRole === 'player1' ? battle.player2PhotoURL : battle.player1PhotoURL,
  } : null;

  const currentScramble = battle?.scrambles?.[battle.currentScrambleIndex] || '';
  const currentRound = battle?.currentRound || 1;
  const totalRounds = battle?.roundCount || 5;
  const isMyTurn = playerRole !== null;

  const solves = battle?.solves || {};
  const player1SolvesArray = battle?.player1 ? solves[battle.player1] || [] : [];
  const player2SolvesArray = battle?.player2 ? solves[battle.player2] || [] : [];

  const currentRoundSolves = {
    [battle?.player1]: player1SolvesArray.find(s => Number(s.round) === Number(currentRound)),
    [battle?.player2]: player2SolvesArray.find(s => Number(s.round) === Number(currentRound)),
  };

  const player1Solve = currentRoundSolves[battle?.player1];
  const player2Solve = currentRoundSolves[battle?.player2];

  const mySolve = playerRole === 'player1' ? player1Solve : playerRole === 'player2' ? player2Solve : null;
  const opponentSolve = playerRole === 'player1' ? player2Solve : playerRole === 'player2' ? player1Solve : null;
  const mySolves = playerRole === 'player1' ? player1SolvesArray : playerRole === 'player2' ? player2SolvesArray : [];
  const opponentSolves = playerRole === 'player1' ? player2SolvesArray : playerRole === 'player2' ? player1SolvesArray : [];

  useEffect(() => {
    if (!battleId) {
      setLoading(false);
      return;
    }

    const battleRef = doc(db, 'battles', battleId);

    const unsubscribeBattle = onSnapshot(
      battleRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log('Battle updated:', data.status, 'Round:', data.currentRound, 'Solves:', Object.keys(data.solves || {}));
          setBattle({ id: docSnap.id, ...data });
        } else {
          setError('Battle not found');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Battle snapshot error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribeBattle();
  }, [battleId]);

  useEffect(() => {
    if (!battle || battle.status !== BATTLE_STATES.COUNTDOWN || !battle.countdownStart) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const remaining = BattleService.calculateCountdown(battle.countdownStart);
      setCountdown(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);

    return () => clearInterval(interval);
  }, [battle?.status, battle?.countdownStart]);

  const submitSolve = useCallback(async (time, penalty = 'none') => {
    if (!battleId || !user?.uid || !battle) return;

    const scrambleIndex = battle.currentScrambleIndex || 0;
    const round = battle.currentRound || 1;
    console.log('Submitting solve:', user.uid, 'time:', time, 'index:', scrambleIndex, 'round:', round);
    
    await BattleService.submitSolve(battleId, user.uid, time, penalty, scrambleIndex, round);
  }, [battleId, user, battle]);

  const startCountdown = useCallback(async () => {
    if (!battleId) return;
    await BattleService.startCountdown(battleId);
  }, [battleId]);

  const nextRound = useCallback(async () => {
    if (!battleId || !battle) return;

    console.log('Moving to next round, current:', battle.currentRound);

    await BattleService.nextRound(
      battleId,
      battle.currentRound || 1,
      battle.roundCount || 5
    );
  }, [battleId, battle]);

  const getMyAverage = useCallback(() => {
    return ResultCalculator.calculateAo5(mySolves);
  }, [mySolves]);

  const getOpponentAverage = useCallback(() => {
    return ResultCalculator.calculateAo5(opponentSolves);
  }, [opponentSolves]);

  const hasPlayerSubmittedCurrentRound = useCallback((uid) => {
    if (!battle || !uid) return false;
    const currentRoundNum = Number(battle.currentRound || 1);
    const playerSolves = solves[uid] || [];
    return playerSolves.some(s => Number(s.round) === currentRoundNum);
  }, [battle, solves]);

  // Check if both players have completed current round by checking solve's round property
  const bothPlayersSubmitted = useCallback(() => {
    if (!battle?.player1 || !battle?.player2) return false;
    const p1Completed = player1SolvesArray.some(s => Number(s.round) === Number(currentRound));
    const p2Completed = player2SolvesArray.some(s => Number(s.round) === Number(currentRound));
    return p1Completed && p2Completed;
  }, [battle, player1SolvesArray, player2SolvesArray, currentRound]);

  return {
    battle,
    loading,
    error,
    countdown,
    playerRole,
    opponent,
    currentScramble,
    currentRound,
    totalRounds,
    isMyTurn,
    mySolves,
    opponentSolves,
    player1Solves: player1SolvesArray,
    player2Solves: player2SolvesArray,
    mySolve,
    opponentSolve,
    player1Solve,
    player2Solve,
    submitSolve,
    startCountdown,
    nextRound,
    getMyAverage,
    getOpponentAverage,
    hasPlayerSubmittedCurrentRound,
    bothPlayersSubmitted,
  };
}
