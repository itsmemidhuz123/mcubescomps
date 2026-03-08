import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminDb() {
  if (getApps().length === 0) {
    initializeApp();
  }
  return getFirestore();
}

function generateScramble(event = '333', roundCount = 5) {
  const scrambles = [];
  for (let i = 0; i < roundCount; i++) {
    const chars = 'RURURFRFRFURURF';
    let scramble = '';
    for (let j = 0; j < 20; j++) {
      scramble += chars[Math.floor(Math.random() * chars.length)] + ' ';
    }
    scrambles.push(scramble.trim());
  }
  return {
    scrambleId: `scramble_${Date.now()}`,
    scrambles: scrambles,
    event: event
  };
}

export async function POST(request) {
  let db;
  try {
    db = getAdminDb();
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    return NextResponse.json(
      { success: false, message: 'Server configuration error: ' + error.message },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { matchId } = body;

    if (!matchId) {
      return NextResponse.json(
        { success: false, message: 'Match ID is required' },
        { status: 400 }
      );
    }

    const matchRef = db.collection('matches').doc(matchId);
    const matchDoc = await matchRef.get();
    
    if (!matchDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Match not found' },
        { status: 404 }
      );
    }
    
    const matchData = matchDoc.data();
    const player1 = matchData.player1;
    const player2 = matchData.player2;
    const player1Name = matchData.player1Name || 'Player 1';
    const player2Name = matchData.player2Name || 'Player 2';

    if (!player1 || !player2) {
      return NextResponse.json(
        { success: false, message: 'Players not found in match' },
        { status: 400 }
      );
    }
    
    if (matchData.battleCreated) {
      return NextResponse.json({
        success: true,
        battleId: matchData.battleId,
      });
    }

    const scrambleData = generateScramble('333', 5);
    const now = new Date();
    
    const battleData = {
      battleId: '',
      battleName: 'Quick Battle',
      battleType: 'quickBattle',
      event: '333',
      scrambleId: scrambleData.scrambleId,
      scrambles: scrambleData.scrambles,
      currentScrambleIndex: 0,
      currentRound: 1,
      createdBy: player1,
      player1: player1,
      player2: player2,
      player1Name: player1Name,
      player2Name: player2Name,
      status: 'waiting',
      winner: null,
      visibility: 'private',
      format: 'ao5',
      winsRequired: 5,
      scores: { player1: 0, player2: 0 },
      allowSpectators: true,
      spectators: [],
      creatorJoined: true,
      opponentJoined: true,
      startTime: null,
      createdAt: now,
      lastActivityAt: now,
      startedAt: null,
      completedAt: null,
      roundCount: 5,
      teamSize: 1,
      teamA: [{ userId: player1, username: player1Name, photoURL: matchData.player1PhotoURL || null }],
      teamB: [{ userId: player2, username: player2Name, photoURL: matchData.player2PhotoURL || null }],
      players: [player1, player2],
    };

    const battleRef = db.collection('battles').doc(matchId + '_battle');
    const battleId = battleRef.id;
    await battleRef.set({ ...battleData, battleId });

    await matchRef.update({
      battleCreated: true,
      battleId: battleId,
    });

    return NextResponse.json({
      success: true,
      battleId,
      message: 'Battle created!',
    });
  } catch (error) {
    console.error('Create battle error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create battle: ' + error.message },
      { status: 500 }
    );
  }
}
