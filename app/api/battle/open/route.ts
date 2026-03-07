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

    const privateKey = privateKeyRaw.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');

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

    // Only creator can open the battle
    if (battleData.createdBy !== userId) {
      return NextResponse.json(
        { success: false, message: 'Only the creator can open this battle' },
        { status: 403 }
      );
    }

    if (battleData.status === 'live') {
      return NextResponse.json(
        { success: false, message: 'Battle is already live' },
        { status: 400 }
      );
    }

    await battleRef.update({
      status: 'waiting',
      visibility: 'public',
    });

    return NextResponse.json({
      success: true,
      message: 'Battle opened successfully',
    });
  } catch (error) {
    console.error('Open battle error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to open battle' },
      { status: 500 }
    );
  }
}
