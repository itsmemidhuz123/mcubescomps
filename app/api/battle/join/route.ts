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
      return NextResponse.json(
        { success: false, message: 'Battle not found' },
        { status: 404 }
      );
    }

    const battleData = battleDoc.data();

    if (battleData.player2 !== null) {
      return NextResponse.json(
        { success: false, message: 'Battle is already full' },
        { status: 400 }
      );
    }

    if (battleData.player1 === userId) {
      return NextResponse.json(
        { success: false, message: 'You cannot join your own battle' },
        { status: 400 }
      );
    }

    if (battleData.status !== 'waiting' && battleData.status !== 'countdown') {
      return NextResponse.json(
        { success: false, message: 'Battle is not accepting players' },
        { status: 400 }
      );
    }

    await battleRef.update({
      player2: userId,
      status: 'waiting',
      startTime: admin.firestore.FieldValue.serverTimestamp(),
      opponentJoined: true,
      lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: 'Joined battle successfully',
      status: 'countdown',
    });
  } catch (error) {
    console.error('Join battle error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to join battle' },
      { status: 500 }
    );
  }
}
