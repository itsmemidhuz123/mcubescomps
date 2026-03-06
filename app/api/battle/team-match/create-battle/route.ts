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

    // Get team info
    const teamSize = matchData.teamSize || 2;
    const event = matchData.event || '333';
    const roundCount = teamSize * 3; // 2v2=6, 4v4=12, 8v8=24 rounds

    // Generate scrambles
    let scrambleData;
    try {
      scrambleData = await generateScrambleForBattle({
        event: event,
        roundCount: roundCount,
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
      battleName: `Team Battle ${teamSize}v${teamSize}`,
      battleType: 'teamBattle',
      event: event,
      scrambleId: scrambleData.scrambleId,
      scrambles: scrambleData.scrambles,
      currentScrambleIndex: 0,
      currentRound: 1,
      createdBy: matchData.teamA[0]?.userId || matchData.player1,
      // Team profiles
      teamA: matchData.teamA || [],
      teamB: matchData.teamB || [],
      // Flat arrays for querying
      players: matchData.players || [],
      playerNames: matchData.playerNames || [],
      status: 'waiting',
      winner: null,
      visibility: 'public',
      format: 'team_ao5', // Team average format
      winsRequired: teamSize, // Win by getting more rounds than opponent
      scores: { player1: 0, player2: 0 },
      // Team scores tracking
      teamASolves: [],
      teamBSolves: [],
      allowSpectators: true,
      spectators: [],
      creatorJoined: true,
      opponentJoined: (matchData.teamB?.length || 0) > 0,
      startTime: null,
      createdAt: now,
      lastActivityAt: now,
      startedAt: null,
      completedAt: null,
      roundCount: roundCount,
      teamSize: teamSize,
    };

    const battleRef = await db.collection('battles').add(battleData);
    const battleId = battleRef.id;
    await battleRef.update({ battleId });

    // Update match to mark battle created
    await matchRef.update({
      battleCreated: true,
      battleId: battleId,
    });

    // Don't delete match - keep for reference

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
