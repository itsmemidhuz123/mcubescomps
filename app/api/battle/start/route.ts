import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import admin from 'firebase-admin';

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
    const { battleId, uid } = body;

    if (!battleId || !uid) {
      return NextResponse.json(
        { success: false, message: 'Battle ID and UID are required' },
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

    if (battleData.status !== 'waiting') {
      return NextResponse.json({
        success: true,
        status: battleData.status,
      });
    }

    const isPlayer1 = battleData.player1 === uid;
    const isPlayer2 = battleData.player2 === uid;
    
    // Check if user is in teamA or teamB (for team battles)
    const teamA = battleData.teamA || [];
    const teamB = battleData.teamB || [];
    // Handle both old format (strings) and new format (objects with userId)
    const isTeamPlayer = teamA.some(p => (typeof p === 'object' ? p.userId : p) === uid) || 
                         teamB.some(p => (typeof p === 'object' ? p.userId : p) === uid);
    const isTeamBattle = battleData.battleType === 'teamBattle';
    
    // For team battles, check team membership; for regular battles, check player1/player2
    const isParticipant = isTeamBattle ? isTeamPlayer : (isPlayer1 || isPlayer2);

    if (!isParticipant) {
      return NextResponse.json(
        { success: false, message: 'Not a participant' },
        { status: 403 }
      );
    }

    if (isTeamBattle) {
      // For team battles, check that at least 2 players have joined
      const playersJoined = (battleData.playersJoined || []).length;
      if (playersJoined < 2) {
        return NextResponse.json(
          { success: false, message: 'Need at least 2 players to start' },
          { status: 400 }
        );
      }
    } else {
      // For regular battles, require both players
      if (!battleData.creatorJoined || !battleData.opponentJoined) {
        return NextResponse.json(
          { success: false, message: 'Both players must be connected to start' },
          { status: 400 }
        );
      }
    }

    await battleRef.update({
      status: 'live',
    });

    return NextResponse.json({
      success: true,
      status: 'live',
    });
  } catch (error) {
    console.error('Start battle error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to start battle' },
      { status: 500 }
    );
  }
}
