import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import admin from 'firebase-admin';

function getAdminDb() {
  if (getApps().length === 0) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!privateKey || privateKey === 'YOUR_PRIVATE_KEY') {
      initializeApp();
    } else {
      privateKey = privateKey.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey
        })
      });
    }
  }
  return admin.firestore();
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
  try {
    const body = await request.json();
    const { matchId } = body;

    if (!matchId) {
      return NextResponse.json(
        { success: false, message: 'Match ID is required' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
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
    const player1Name = matchData.player1Name || matchData.player1Username || 'Player 1';
    const player2Name = matchData.player2Name || matchData.player2Username || 'Player 2';

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

    let scrambleData;
    try {
      scrambleData = generateScramble('333', 5);
    } catch (scrambleError) {
      return NextResponse.json(
        { success: false, message: 'Failed to generate scrambles' },
        { status: 500 }
      );
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    
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
      player1Name: player1Name || 'Player 1',
      player2Name: player2Name || 'Player 2',
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

    try {
      await matchRef.update({
        battleCreated: true,
        battleId: battleId,
        completedAt: now,
      });
    } catch (updateErr) {
      console.log('Match update skipped:', updateErr.message);
    }

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
