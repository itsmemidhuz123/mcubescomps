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
    
    // Fetch match document to get player data (more reliable than client-passed data)
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

    // Generate scrambles
    let scrambleData;
    try {
      scrambleData = await generateScrambleForBattle({
        event: '333',
        roundCount: 5,
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

    const battleRef = await db.collection('battles').add(battleData);
    const battleId = battleRef.id;
    await battleRef.update({ battleId });

    // Update match with battleId instead of deleting - prevents race condition
    // Both players will see the battleId and can redirect
    try {
      await matchRef.update({
        battleCreated: true,
        battleId: battleId,
        completedAt: now,
      });
    } catch (updateErr) {
      // Match might have been updated by another request, that's OK
      console.log('Match update skipped:', updateErr.message);
    }

    // Don't delete the match document - let it remain for a bit for both players to find it
    // It will be cleaned up by a separate cleanup process

    return NextResponse.json({
      success: true,
      battleId,
      message: 'Battle created!',
    });
  } catch (error) {
    console.error('Create battle error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create battle' },
      { status: 500 }
    );
  }
}
