import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import admin from 'firebase-admin';
import { generateScrambleForBattle } from '@/services/scrambleService';

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
    const { matchId } = body;

    if (!matchId) {
      return NextResponse.json(
        { success: false, message: 'Match ID is required' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    
    // Get the match document
    const matchRef = db.collection('matches').doc(matchId);
    const matchDoc = await matchRef.get();
    
    if (!matchDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Match not found' },
        { status: 404 }
      );
    }
    
    const matchData = matchDoc.data();
    if (!matchData) {
      return NextResponse.json(
        { success: false, message: 'Match data not found' },
        { status: 404 }
      );
    }
    
    // Check if battle already created
    if (matchData.battleCreated && matchData.battleId) {
      return NextResponse.json({
        success: true,
        battleId: matchData.battleId,
      });
    }

    // Generate scrambles
    let scrambleData;
    try {
      scrambleData = await generateScrambleForBattle({
        event: '333',
        roundCount: 3,
      });
    } catch (scrambleError) {
      return NextResponse.json(
        { success: false, message: 'Failed to generate scrambles' },
        { status: 500 }
      );
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    
    const battleData = {
      battleId: '',
      battleName: `Team Battle ${matchData.teamSize}v${matchData.teamSize}`,
      battleType: 'teamBattle',
      event: '333',
      scrambleId: scrambleData.scrambleId,
      scrambles: scrambleData.scrambles,
      currentScrambleIndex: 0,
      currentRound: 1,
      createdBy: matchData.player1,
      player1: matchData.player1,
      player2: matchData.teamB[0] || null,
      status: 'waiting',
      winner: null,
      visibility: 'public',
      format: 'bo3',
      winsRequired: 3,
      scores: { player1: 0, player2: 0 },
      allowSpectators: true,
      spectators: [],
      creatorJoined: true,
      opponentJoined: matchData.teamB.length > 0,
      startTime: null,
      createdAt: now,
      lastActivityAt: now,
      startedAt: null,
      completedAt: null,
      roundCount: 3,
      teamSize: matchData.teamSize,
      teamA: matchData.teamA,
      teamB: matchData.teamB,
      players: matchData.players,
    };

    const battleRef = await db.collection('battles').add(battleData);
    const battleId = battleRef.id;
    await battleRef.update({ battleId });

    // Update match to mark battle created
    await matchRef.update({
      battleCreated: true,
      battleId: battleId,
    });

    // Delete the match document
    await matchRef.delete();

    return NextResponse.json({
      success: true,
      battleId,
      message: 'Battle created!',
    });
  } catch (error) {
    console.error('Create team battle error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create battle' },
      { status: 500 }
    );
  }
}
