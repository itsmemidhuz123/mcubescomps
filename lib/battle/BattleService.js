import { db } from '@/lib/firebase';
import { doc, updateDoc, collection, addDoc, setDoc, serverTimestamp, arrayUnion, getDoc } from 'firebase/firestore';
import { BATTLE_STATES, COUNTDOWN_SECONDS } from '../battleUtils';
import { generateScrambles } from '@/lib/scrambleService';
import { ResultCalculator } from './ResultCalculator';
import { EventEngine } from './EventEngine';

export class BattleService {
  constructor(battleId) {
    this.battleId = battleId;
    this.battleRef = doc(db, 'battles', battleId);
  }

  static async createBattle(player1, event = '333') {
    const scrambleData = await generateScrambles(event, 5);
    const eventConfig = EventEngine.getEvent(event);

    const battleData = {
      battleType: 'quickBattle',
      event: event,
      scrambleId: scrambleData.scrambleId,
      scrambles: scrambleData.scrambles,
      currentScrambleIndex: 0,
      currentRound: 1,
      roundCount: eventConfig.getScrambleCount(),
      player1: player1.uid,
      player1Name: player1.displayName || player1.username || 'Player 1',
      player1PhotoURL: player1.photoURL || null,
      player2: null,
      player2Name: null,
      player2PhotoURL: null,
      status: BATTLE_STATES.WAITING,
      winner: null,
      format: 'ao5',
      scores: { player1: 0, player2: 0 },
      allowSpectators: true,
      spectators: [],
      createdBy: player1.uid,
      createdAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
      startedAt: null,
      completedAt: null,
    };

    const battleRef = await addDoc(collection(db, 'battles'), battleData);
    return battleRef.id;
  }

  static async joinBattle(battleId, player2) {
    const battleRef = doc(db, 'battles', battleId);
    await updateDoc(battleRef, {
      player2: player2.uid,
      player2Name: player2.displayName || player2.username || 'Player 2',
      player2PhotoURL: player2.photoURL || null,
      lastActivityAt: serverTimestamp(),
    });
  }

  static async startCountdown(battleId) {
    const battleRef = doc(db, 'battles', battleId);
    await updateDoc(battleRef, {
      status: BATTLE_STATES.COUNTDOWN,
      countdownStart: serverTimestamp(),
      countdownStarted: true,
      lastActivityAt: serverTimestamp(),
    });
  }

  static async startBattle(battleId) {
    const battleRef = doc(db, 'battles', battleId);
    await updateDoc(battleRef, {
      status: BATTLE_STATES.LIVE,
      startedAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
    });
  }

  static async nextRound(battleId, currentRound, totalRounds) {
    const nextRoundNum = currentRound + 1;
    
    if (nextRoundNum > totalRounds) {
      const battleRef = doc(db, 'battles', battleId);
      const battleSnap = await getDoc(battleRef);
      const battle = battleSnap.data();
      
      const player1 = battle.player1;
      const player2 = battle.player2;
      
      const player1Solves = battle.solves?.[player1] || [];
      const player2Solves = battle.solves?.[player2] || [];
      
      console.log('=== CALCULATING WINNER ===');
      console.log('Player 1 solves:', player1Solves.length, player1Solves);
      console.log('Player 2 solves:', player2Solves.length, player2Solves);
      
      const avg1 = ResultCalculator.calculateAo5(player1Solves);
      const avg2 = ResultCalculator.calculateAo5(player2Solves);
      
      console.log('Player 1 Ao5:', avg1);
      console.log('Player 2 Ao5:', avg2);
      
      let winner = null;
      let winnerName = 'Tie';
      
      if (avg1 !== null && avg2 !== null) {
        if (avg1 < avg2) {
          winner = player1;
          winnerName = battle.player1Name;
        } else if (avg2 < avg1) {
          winner = player2;
          winnerName = battle.player2Name;
        }
      } else if (avg1 !== null && avg2 === null) {
        winner = player1;
        winnerName = battle.player1Name;
      } else if (avg2 !== null && avg1 === null) {
        winner = player2;
        winnerName = battle.player2Name;
      }
      
      console.log('Winner:', winnerName);
      
      await updateDoc(battleRef, {
        status: BATTLE_STATES.COMPLETED,
        winner: winner,
        winnerName: winnerName,
        player1Avg: avg1,
        player2Avg: avg2,
        player1Solves: player1Solves,
        player2Solves: player2Solves,
        completedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
      });
      
      return { completed: true, winner, winnerName, avg1, avg2, nextRound: null };
    }

    console.log('Moving to round:', nextRoundNum);

    await updateDoc(doc(db, 'battles', battleId), {
      currentScrambleIndex: nextRoundNum - 1,
      currentRound: nextRoundNum,
      lastActivityAt: serverTimestamp(),
    });

    return { completed: false, nextRound: nextRoundNum };
  }

  static async setWinner(battleId, winner) {
    const battleRef = doc(db, 'battles', battleId);
    await updateDoc(battleRef, {
      winner: winner,
      status: BATTLE_STATES.COMPLETED,
      completedAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
    });
  }

  static calculateCountdown(countdownStart) {
    if (!countdownStart) return COUNTDOWN_SECONDS;
    
    const startTime = countdownStart.toDate ? countdownStart.toDate() : new Date(countdownStart._seconds * 1000);
    const now = Date.now();
    const elapsed = Math.floor((now - startTime.getTime()) / 1000);
    const remaining = COUNTDOWN_SECONDS - elapsed;
    
    return Math.max(0, remaining);
  }

  static isCountdownComplete(countdownStart) {
    return this.calculateCountdown(countdownStart) <= 0;
  }

  static async submitSolve(battleId, userId, time, penalty = 'none', scrambleIndex, round) {
    const battleRef = doc(db, 'battles', battleId);
    
    const solveData = {
      uid: userId,
      time: time,
      penalty: penalty,
      scrambleIndex: scrambleIndex,
      round: round,
      submittedAt: Date.now(),
    };

    console.log('=== SUBMITTING SOLVE ===');
    console.log('Battle:', battleId);
    console.log('User:', userId);
    console.log('Time:', time);
    console.log('Penalty:', penalty);
    console.log('Scramble Index:', scrambleIndex);
    console.log('Round:', round);

    await updateDoc(battleRef, {
      [`solves.${userId}`]: arrayUnion(solveData),
      lastActivityAt: serverTimestamp(),
    });
    console.log('Solve saved to battle document');
    
    return solveData;
  }

  static getPlayerRole(battle, userId) {
    if (!battle) return null;
    if (battle.player1 === userId) return 'player1';
    if (battle.player2 === userId) return 'player2';
    return null;
  }

  static isPlayerTurn(battle, userId) {
    return this.getPlayerRole(battle, userId) !== null;
  }

  static validateSolveTime(time) {
    const MIN_SOLVE_TIME = 1000;
    return time >= MIN_SOLVE_TIME;
  }

  static checkBothPlayersFinished(battle, solves) {
    if (!battle || !battle.player1 || !battle.player2) return false;
    
    const player1Solves = solves[battle.player1] || [];
    const player2Solves = solves[battle.player2] || [];
    
    const currentIndex = battle.currentScrambleIndex || 0;
    
    const p1Finished = player1Solves.some(s => s.scrambleIndex === currentIndex);
    const p2Finished = player2Solves.some(s => s.scrambleIndex === currentIndex);
    
    return p1Finished && p2Finished;
  }

  static calculateWinner(battle, solves) {
    if (!battle || !battle.player1 || !battle.player2) return null;
    
    const player1Solves = (solves[battle.player1] || []).map(s => ({
      time: s.time,
      penalty: s.penalty,
    }));
    
    const player2Solves = (solves[battle.player2] || []).map(s => ({
      time: s.time,
      penalty: s.penalty,
    }));

    const result = ResultCalculator.compareResults(player1Solves, player2Solves);
    
    if (result === 'player1') return battle.player1;
    if (result === 'player2') return battle.player2;
    return 'tie';
  }
}

export const battleService = (battleId) => new BattleService(battleId);
