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

    if (battleData.status !== 'countdown') {
      return NextResponse.json({
        success: true,
        status: battleData.status,
      });
    }

    const isPlayer1 = battleData.player1 === uid;
    const isPlayer2 = battleData.player2 === uid;

    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json(
        { success: false, message: 'Not a participant' },
        { status: 403 }
      );
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
