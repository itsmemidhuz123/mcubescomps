import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminDb() {
  if (getApps().length === 0) {
    initializeApp();
  }
  return getFirestore();
}

export async function DELETE(request) {
  let db;
  try {
    db = getAdminDb();
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    return NextResponse.json(
      { success: false, message: 'Server configuration error: ' + error.message },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    await db.collection('matchmakingQueue').doc(userId).delete();

    return NextResponse.json({
      success: true,
      message: 'Removed from queue',
    });
  } catch (error) {
    console.error('Leave queue error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to leave queue: ' + error.message },
      { status: 500 }
    );
  }
}
