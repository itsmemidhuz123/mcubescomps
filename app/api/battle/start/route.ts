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

export async function POST(request) {
  try {
    const body = await request.json();
    const { battleId, userId } = body;

    if (!battleId || !userId) {
      return NextResponse.json(
        { success: false, message: 'Battle ID and User ID are required' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const battleRef = db.collection('battles').doc(battleId);
    const battleDoc = await battleRef.get();

    if (!battleDoc.exists) {
      return NextResponse.json({ success: false, message: 'Battle not found' }, { status: 404 });
    }

    const battleData = battleDoc.data();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const isPlayer1 = battleData.player1 === userId;
    const isPlayer2 = battleData.player2 === userId;

    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json({ success: false, message: 'Not a participant' }, { status: 400 });
    }

    if (battleData.battleType === 'teamBattle') {
      const teamA = battleData.teamA || [];
      const teamB = battleData.teamB || [];
      const isTeamPlayer = teamA.some(p => p.userId === userId) || teamB.some(p => p.userId === userId);
      
      if (!isTeamPlayer) {
        return NextResponse.json({ success: false, message: 'Not a participant' }, { status: 400 });
      }

      const playersJoined = (battleData.playersJoined || []).length;
      if (playersJoined < 4) {
        return NextResponse.json({ success: false, message: 'Need at least 4 players to start' }, { status: 400 });
      }
    } else {
      if (!battleData.player1 || !battleData.player2) {
        return NextResponse.json({ success: false, message: 'Waiting for opponent' }, { status: 400 });
      }
    }

    if (battleData.status !== 'waiting') {
      return NextResponse.json({ success: false, message: 'Battle already started' }, { status: 400 });
    }

    await battleRef.update({
      status: 'countdown',
      startTime: now,
      startedAt: now,
      lastActivityAt: now,
    });

    return NextResponse.json({ success: true, message: 'Battle starting!' });
  } catch (error) {
    console.error('Start battle error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to start battle: ' + error.message },
      { status: 500 }
    );
  }
}
