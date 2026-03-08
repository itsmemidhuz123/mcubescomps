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

    if (matchData.battleCreated) {
      return NextResponse.json({ success: true, battleId: matchData.battleId });
    }

    let scrambleData;
    try {
      scrambleData = generateScramble(matchData.event || '333', 5);
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Failed to generate scrambles' },
        { status: 500 }
      );
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const teamSize = matchData.teamSize || 2;

    const battleData = {
      battleId: '',
      battleName: `Team Battle ${teamSize}v${teamSize}`,
      battleType: 'teamBattle',
      event: matchData.event || '333',
      scrambleId: scrambleData.scrambleId,
      scrambles: scrambleData.scrambles,
      currentScrambleIndex: 0,
      currentRound: 1,
      createdBy: matchData.players?.[0],
      status: 'waiting',
      winner: null,
      visibility: 'public',
      format: 'firstTo3',
      winsRequired: 3,
      scores: { player1: 0, player2: 0 },
      allowSpectators: true,
      spectators: [],
      startTime: null,
      createdAt: now,
      lastActivityAt: now,
      startedAt: null,
      completedAt: null,
      roundCount: 5,
      teamSize: teamSize,
      teamA: matchData.teamA || [],
      teamB: matchData.teamB || [],
      players: matchData.players || [],
      playersJoined: matchData.playersJoined || [],
    };

    const battleRef = db.collection('battles').doc(matchId + '_team_battle');
    const battleId = battleRef.id;
    await battleRef.set({ ...battleData, battleId });

    await matchRef.update({
      battleCreated: true,
      battleId: battleId,
    });

    return NextResponse.json({ success: true, battleId, message: 'Team battle created!' });
  } catch (error) {
    console.error('Create team battle error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create team battle: ' + error.message },
      { status: 500 }
    );
  }
}
