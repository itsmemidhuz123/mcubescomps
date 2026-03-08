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
    const { battleId, userId, username, photoURL } = body;

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

    if (battleData.status !== 'waiting') {
      return NextResponse.json({ success: false, message: 'Battle already started' }, { status: 400 });
    }

    if (battleData.player1 === userId || battleData.player2 === userId) {
      return NextResponse.json({ success: true, battleId, message: 'Already joined' });
    }

    if (battleData.player2) {
      return NextResponse.json({ success: false, message: 'Battle is full' });
    }

    await battleRef.update({
      player2: userId,
      player2Name: username || 'Player 2',
      opponentJoined: true,
      lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
      teamB: [{ userId, username: username || 'Player 2', photoURL: photoURL || null }],
      players: admin.firestore.FieldValue.arrayUnion(userId),
    });

    return NextResponse.json({ success: true, battleId, message: 'Joined battle successfully!' });
  } catch (error) {
    console.error('Join battle error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to join battle: ' + error.message },
      { status: 500 }
    );
  }
}
