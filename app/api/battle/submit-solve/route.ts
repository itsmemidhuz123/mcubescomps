import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import admin from 'firebase-admin';
import { 
  PENALTY, 
  calculateAo5, 
  calculateBestSingle, 
  determineBattleWinner, 
  TOTAL_SCRAMBLES,
  getScrambleWinner,
  BATTLE_FORMATS,
  calculateBattleEloChanges,
  ELO_DEFAULT_RATING
} from '@/lib/battleUtils';

function getAdminDb() {
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKeyRaw) {
      throw new Error('Firebase Admin env vars not configured');
    }

    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey })
    });
  }
  return admin.firestore();
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { battleId, uid, time, penalty = 0, scrambleIndex, reason, flags = [] } = body;

    if (!battleId || !uid || time === undefined || time === null) {
      return NextResponse.json(
        { success: false, message: 'Battle ID, UID, and time are required' },
        { status: 400 }
      );
    }

    if (typeof time !== 'number' || time < 100) {
      return NextResponse.json(
        { success: false, message: 'Time must be at least 0.1 seconds' },
        { status: 400 }
      );
    }

    if (penalty !== 0 && penalty !== 2 && penalty !== -1) {
      return NextResponse.json(
        { success: false, message: 'Invalid penalty value' },
        { status: 400 }
      );
    }

    if (penalty === -1 && reason !== 'MANUAL_DNF' && reason !== 'INSPECTION_DNF' && reason !== 'TIMEOUT_DNF') {
      return NextResponse.json(
        { success: false, message: 'DNF requires a valid reason' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const battleRef = db.collection('battles').doc(battleId);
    const battleDoc = await battleRef.get();

    if (!battleDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Battle not found' },
        { status: 404 }
      );
    }

    const battleData = battleDoc.data();

    if (battleData.status === 'completed') {
      return NextResponse.json(
        { success: false, message: 'Battle is already completed' },
        { status: 400 }
      );
    }

    if (battleData.status === 'countdown') {
      return NextResponse.json(
        { success: false, message: 'Battle is starting - please wait' },
        { status: 400 }
      );
    }

    const isPlayer1 = battleData.player1 === uid;
    const isPlayer2 = battleData.player2 === uid;

    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json(
        { success: false, message: 'Not a participant in this battle' },
        { status: 403 }
      );
    }

    const solvesRef = battleRef.collection('solves').doc(uid);
    const solvesDoc = await solvesRef.get();

    let existingSolves = [];
    if (solvesDoc.exists) {
      existingSolves = solvesDoc.data().solves || [];
    }

    const expectedIndex = existingSolves.length;
    if (scrambleIndex !== expectedIndex) {
      return NextResponse.json(
        { success: false, message: 'Invalid scramble index' },
        { status: 400 }
      );
    }

    const solveEntry = {
      scrambleIndex,
      time: time,
      penalty: penalty,
      reason: reason || null,
      timestamp: Date.now(),
      submittedAt: Date.now(),
      locked: true,
      flags: flags,
    };

    existingSolves.push(solveEntry);

    const ao5 = calculateAo5(existingSolves);
    const bestSingle = calculateBestSingle(existingSolves);

    await solvesRef.set({
      uid,
      solves: existingSolves,
      ao5,
      bestSingle,
      lastUpdated: Date.now(),
    });

    // Check if this is a team battle
    const isTeamBattle = battleData.battleType === 'teamBattle';
    
    if (isTeamBattle) {
      return handleTeamBattleScore(db, battleRef, battleData, uid, time, penalty, scrambleIndex, existingSolves, ao5);
    }

    // Original 1v1 scoring logic
    const player1SolvesData = await battleRef.collection('solves').doc(battleData.player1).get();
    const player2SolvesData = await battleRef.collection('solves').doc(battleData.player2).get();

    const p1Solves = player1SolvesData.exists ? (player1SolvesData.data().solves || []) : [];
    const p2Solves = player2SolvesData.exists ? (player2SolvesData.data().solves || []) : [];

    if (!battleData.player2) {
      return NextResponse.json({
        success: true,
        solves: existingSolves,
        ao5,
        battleStatus: 'waiting',
        winner: null,
      });
    }

    const format = battleData.format || 'ao5';
    const winsRequired = battleData.winsRequired;
    const bothReadyForNext = p1Solves.length === p2Solves.length;
    const currentScores = battleData.scores || { player1: 0, player2: 0 };

    let battleUpdate: Record<string, unknown> = {};
    let winner = null;
    let newScores = { ...currentScores };

    if (bothReadyForNext) {
      const scrambleWinner = getScrambleWinner(
        p1Solves[p1Solves.length - 1],
        p2Solves[p2Solves.length - 1]
      );

      if (scrambleWinner === 'player1') {
        newScores.player1++;
      } else if (scrambleWinner === 'player2') {
        newScores.player2++;
      }

      battleUpdate.scores = newScores;

      const isFormatComplete = (format === BATTLE_FORMATS.AO5 && p1Solves.length >= TOTAL_SCRAMBLES) ||
                              (format === BATTLE_FORMATS.SINGLE && p1Solves.length >= 1) ||
                              (winsRequired && (newScores.player1 >= winsRequired || newScores.player2 >= winsRequired));

      if (isFormatComplete) {
        const result = determineBattleWinner(p1Solves, p2Solves, format, winsRequired, battleData.roundCount);
        
        if (result === 'player1') {
          winner = battleData.player1;
        } else if (result === 'player2') {
          winner = battleData.player2;
        } else {
          winner = 'tie';
        }

        battleUpdate = {
          ...battleUpdate,
          status: 'completed',
          winner,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const player1UserDoc = await db.collection('users').doc(battleData.player1).get();
        const player2UserDoc = await db.collection('users').doc(battleData.player2).get();

        const player1Data = player1UserDoc.exists ? player1UserDoc.data() : {};
        const player2Data = player2UserDoc.exists ? player2UserDoc.data() : {};

        const event = battleData.event || '333';
        const ratingField = `rating${event}`;
        
        const player1Rating = (player1Data[ratingField] || ELO_DEFAULT_RATING);
        const player2Rating = (player2Data[ratingField] || ELO_DEFAULT_RATING);

        const resultKey = result === 'player1' ? 'player1' : (result === 'player2' ? 'player2' : 'tie');
        const eloChanges = calculateBattleEloChanges(player1Rating, player2Rating, resultKey);

        await db.collection('users').doc(battleData.player1).set({
          [ratingField]: Math.max(100, player1Rating + eloChanges.player1Change),
        }, { merge: true });

        await db.collection('users').doc(battleData.player2).set({
          [ratingField]: Math.max(100, player2Rating + eloChanges.player2Change),
        }, { merge: true });
      } else if (newScores.player1 !== currentScores.player1 || newScores.player2 !== currentScores.player2) {
        const nextIndex = (battleData.currentScrambleIndex || 0) + 1;
        battleUpdate = {
          ...battleUpdate,
          currentScrambleIndex: nextIndex,
          currentRound: (battleData.currentRound || 1) + 1,
        };
      }
    }

    if (Object.keys(battleUpdate).length > 0) {
      battleUpdate.lastActivityAt = admin.firestore.FieldValue.serverTimestamp();
      await battleRef.update(battleUpdate);
    }

    const currentStatus = battleUpdate.status || battleData.status || 'live';

    return NextResponse.json({
      success: true,
      solves: existingSolves,
      ao5,
      scores: newScores,
      battleStatus: currentStatus,
      winner,
    });
  } catch (error) {
    console.error('Submit solve error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to submit solve' },
      { status: 500 }
    );
  }
}

// Team battle scoring handler
async function handleTeamBattleScore(db, battleRef, battleData, uid, time, penalty, scrambleIndex, existingSolves, ao5) {
  const teamA = battleData.teamA || [];
  const teamB = battleData.teamB || [];
  const teamSize = teamA.length;
  const winsRequired = battleData.winsRequired || teamSize;
  
  // Determine which team the player is on - handle both old format (strings) and new format (objects with userId)
  const playerTeamA = teamA.some(p => (typeof p === 'object' ? p.userId : p) === uid);
  const playerTeamB = teamB.some(p => (typeof p === 'object' ? p.userId : p) === uid);
  
  // Get all team member solves - handle both old and new formats
  const teamASolvesPromises = teamA.map(async (player) => {
    const playerId = typeof player === 'object' ? player.userId : player;
    const doc = await battleRef.collection('solves').doc(playerId).get();
    return doc.exists ? doc.data().solves || [] : [];
  });
  const teamBSolvesPromises = teamB.map(async (player) => {
    const playerId = typeof player === 'object' ? player.userId : player;
    const doc = await battleRef.collection('solves').doc(playerId).get();
    return doc.exists ? doc.data().solves || [] : [];
  });
  
  const teamASolvesArrays = await Promise.all(teamASolvesPromises);
  const teamBSolvesArrays = await Promise.all(teamBSolvesPromises);
  
  // Calculate team averages (only count non-DNF times)
  const calculateTeamAverage = (solvesArrays) => {
    let totalTime = 0;
    let count = 0;
    solvesArrays.forEach(solves => {
      const lastSolve = solves[solves.length - 1];
      if (lastSolve && lastSolve.time > 0 && lastSolve.penalty !== -1) {
        totalTime += lastSolve.time + (lastSolve.penalty === 2 ? 2000 : 0);
        count++;
      }
    });
    return count > 0 ? Math.round(totalTime / count) : null;
  };
  
  const teamAAverage = calculateTeamAverage(teamASolvesArrays);
  const teamBAverage = calculateTeamAverage(teamBSolvesArrays);
  
  // Get current scores
  const currentScores = battleData.teamScores || { teamA: 0, teamB: 0 };
  let newScores = { ...currentScores };
  let winner = null;
  let battleUpdate: Record<string, unknown> = {};
  
  // Check if both teams have submitted this round
  const teamAMembersWithSolves = teamASolvesArrays.filter(s => s.length >= scrambleIndex + 1).length;
  const teamBMembersWithSolves = teamBSolvesArrays.filter(s => s.length >= scrambleIndex + 1).length;
  
  // If both teams have completed this round
  if (teamAAverage !== null && teamBAverage !== null && teamAMembersWithSolves === teamA.length && teamBMembersWithSolves === teamB.length) {
    // Compare team averages - lower is better
    if (teamAAverage < teamBAverage) {
      newScores.teamA++;
    } else if (teamBAverage < teamAAverage) {
      newScores.teamB++;
    }
    // If equal, no one gets a point (tie)
    
    battleUpdate.teamScores = newScores;
    
    // Check if battle is complete
    if (newScores.teamA >= winsRequired || newScores.teamB >= winsRequired) {
      winner = newScores.teamA >= winsRequired ? 'teamA' : 'teamB';
      
      battleUpdate.status = 'completed';
      battleUpdate.winner = winner;
      battleUpdate.completedAt = admin.firestore.FieldValue.serverTimestamp();
      battleUpdate.teamAAverage = teamAAverage;
      battleUpdate.teamBAverage = teamBAverage;
    } else if (scrambleIndex + 1 >= (battleData.roundCount || 6)) {
      // All rounds complete
      if (newScores.teamA > newScores.teamB) {
        winner = 'teamA';
      } else if (newScores.teamB > newScores.teamA) {
        winner = 'teamB';
      } else {
        winner = 'tie';
      }
      
      battleUpdate.status = 'completed';
      battleUpdate.winner = winner;
      battleUpdate.completedAt = admin.firestore.FieldValue.serverTimestamp();
      battleUpdate.teamAAverage = teamAAverage;
      battleUpdate.teamBAverage = teamBAverage;
    } else {
      // Move to next round
      battleUpdate.currentScrambleIndex = (battleData.currentScrambleIndex || 0) + 1;
      battleUpdate.currentRound = (battleData.currentRound || 1) + 1;
    }
  }
  
  if (Object.keys(battleUpdate).length > 0) {
    battleUpdate.lastActivityAt = admin.firestore.FieldValue.serverTimestamp();
    await battleRef.update(battleUpdate);
  }
  
  const currentStatus = battleUpdate.status || battleData.status || 'live';
  
  return NextResponse.json({
    success: true,
    solves: existingSolves,
    ao5,
    teamScores: newScores,
    teamAAverage,
    teamBAverage,
    battleStatus: currentStatus,
    winner,
  });
}
