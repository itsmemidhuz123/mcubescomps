'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, collection, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BATTLE_STATES, PENALTY, calculateAo5, calculateBestSingle, TOTAL_SCRAMBLES } from '@/lib/battleUtils';

export function useBattle(battleId, currentUserUid) {
  const [battle, setBattle] = useState(null);
  const [player1Solves, setPlayer1Solves] = useState([]);
  const [player2Solves, setPlayer2Solves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Subscribe to battle data
  useEffect(() => {
    if (!battleId || !currentUserUid) {
      setLoading(false);
      return;
    }

    const battleRef = doc(db, 'battles', battleId);

    const unsubscribeBattle = onSnapshot(battleRef, (docSnap) => {
      if (docSnap.exists()) {
        setBattle({ id: docSnap.id, ...docSnap.data() });
      } else {
        setError('Battle not found');
      }
      setLoading(false);
    }, (err) => {
      console.error('Battle snapshot error:', err);
      setError(err.message);
      setLoading(false);
    });

    return () => {
      unsubscribeBattle();
    };
  }, [battleId, currentUserUid]);

  // Subscribe to solves for the current battle
  useEffect(() => {
    if (!battle) return;
    const solvesRef = collection(db, 'battles', battleId, 'solves');
    const unsubscribeSolves = onSnapshot(solvesRef, (snapshot) => {
      const solvesData = {};
      snapshot.forEach((doc) => {
        solvesData[doc.id] = doc.data();
      });
      const p1Solves = battle.player1 ? (solvesData[battle.player1]?.solves || []) : [];
      const p2Solves = battle.player2 ? (solvesData[battle.player2]?.solves || []) : [];
      setPlayer1Solves(Array.isArray(p1Solves) ? p1Solves : []);
      setPlayer2Solves(Array.isArray(p2Solves) ? p2Solves : []);
    }, (err) => {
      console.error('Solves snapshot error:', err);
    });
    return () => {
      unsubscribeSolves();
    };
  }, [battle, battleId]);

  const getMySolves = useCallback(() => {
    if (!battle || !currentUserUid) return [];
    
    // Check for team battle
    const isTeamBattle = battle.battleType === 'teamBattle' || (battle.teamSize && battle.teamSize > 1);
    const teamA = battle.teamA || [];
    const teamB = battle.teamB || [];
    
    // Handle both old format (strings) and new format (objects with userId)
    const isTeamPlayer = teamA.some(p => (typeof p === 'object' ? p.userId : p) === currentUserUid) || 
                         teamB.some(p => (typeof p === 'object' ? p.userId : p) === currentUserUid);
    
    if (isTeamBattle && isTeamPlayer) {
      return Array.isArray(player1Solves) ? player1Solves : [];
    }
    
    if (!battle.player1 || !battle.player2) return [];
    if (battle.player1 === currentUserUid) return Array.isArray(player1Solves) ? player1Solves : [];
    if (battle.player2 === currentUserUid) return Array.isArray(player2Solves) ? player2Solves : [];
    return [];
  }, [battle, currentUserUid, player1Solves, player2Solves]);

  const getOpponentSolves = useCallback(() => {
    if (!battle || !currentUserUid) return [];
    
    // Check for team battle
    const isTeamBattle = battle.battleType === 'teamBattle' || (battle.teamSize && battle.teamSize > 1);
    const teamA = battle.teamA || [];
    const teamB = battle.teamB || [];
    
    // Handle both old format (strings) and new format (objects with userId)
    const isTeamPlayer = teamA.some(p => (typeof p === 'object' ? p.userId : p) === currentUserUid) || 
                         teamB.some(p => (typeof p === 'object' ? p.userId : p) === currentUserUid);
    
    if (isTeamBattle && isTeamPlayer) {
      return Array.isArray(player2Solves) ? player2Solves : [];
    }
    
    if (!battle.player1 || !battle.player2) return [];
    if (battle.player1 === currentUserUid) return Array.isArray(player2Solves) ? player2Solves : [];
    if (battle.player2 === currentUserUid) return Array.isArray(player1Solves) ? player1Solves : [];
    return [];
  }, [battle, currentUserUid, player1Solves, player2Solves]);

  const getCurrentScramble = useCallback(() => {
    if (!battle || !battle.scrambles) return '';
    const index = battle.currentScrambleIndex || 0;
    return battle.scrambles[index] || '';
  }, [battle]);

  const canViewNextScramble = useCallback(() => {
    if (!battle) return false;
    const mySolves = getMySolves();
    const opponentSolves = getOpponentSolves();
    return mySolves.length === opponentSolves.length;
  }, [battle, getMySolves, getOpponentSolves]);

  const isMyTurn = useCallback(() => {
    if (!battle || battle.status !== BATTLE_STATES.LIVE) return false;
    if (!currentUserUid) return false;
    
    const mySolves = getMySolves();
    const opponentSolves = getOpponentSolves();
    
    return mySolves.length <= opponentSolves.length;
  }, [battle, currentUserUid, getMySolves, getOpponentSolves]);

  const canSubmitSolve = useCallback((scrambleIndex) => {
    if (!battle || battle.status !== BATTLE_STATES.LIVE) return false;
    if (!currentUserUid) return false;
    
    const mySolves = getMySolves();
    const expectedIndex = mySolves.length;
    
    return scrambleIndex === expectedIndex;
  }, [battle, currentUserUid, getMySolves]);

  const isBattleComplete = useCallback(() => {
    if (!battle) return false;
    if (battle.status !== BATTLE_STATES.LIVE) return false;
    
    const totalSolves = player1Solves.length + player2Solves.length;
    return totalSolves >= TOTAL_SCRAMBLES * 2;
  }, [battle, player1Solves, player2Solves]);

  const myAo5 = useCallback(() => {
    return calculateAo5(getMySolves());
  }, [getMySolves]);

  const opponentAo5 = useCallback(() => {
    return calculateAo5(getOpponentSolves());
  }, [getOpponentSolves]);

  const myBestSingle = useCallback(() => {
    return calculateBestSingle(getMySolves());
  }, [getMySolves]);

  const opponentBestSingle = useCallback(() => {
    return calculateBestSingle(getOpponentSolves());
  }, [getOpponentSolves]);

  return {
    battle,
    loading,
    error,
    player1Solves,
    player2Solves,
    getMySolves,
    getOpponentSolves,
    getCurrentScramble,
    canViewNextScramble,
    isMyTurn,
    canSubmitSolve,
    isBattleComplete,
    myAo5,
    opponentAo5,
    myBestSingle,
    opponentBestSingle,
  };
}

export async function submitSolve(battleId, uid, solveData) {
  const { time, penalty = PENALTY.NONE, scrambleIndex } = solveData;
  
  const solvesRef = doc(db, 'battles', battleId, 'solves', uid);
  
  const solveEntry = {
    scrambleIndex,
    time,
    penalty,
    timestamp: Date.now(),
  };

  const docSnap = await getDoc(solvesRef);
  let existingSolves = [];
  
  if (docSnap.exists()) {
    existingSolves = docSnap.data().solves || [];
  }

  existingSolves.push(solveEntry);

  await setDoc(solvesRef, {
    uid,
    solves: existingSolves,
    ao5: calculateAo5(existingSolves),
    bestSingle: calculateBestSingle(existingSolves),
    lastUpdated: Date.now(),
  });

  return solveEntry;
}
