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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const event = searchParams.get('event') || '333';
    const limit = parseInt(searchParams.get('limit')) || 50;

    const db = getAdminDb();
    
    const ratingField = `rating${event}`;
    
    const snapshot = await db.collection('users')
      .orderBy(ratingField, 'desc')
      .limit(limit)
      .get();

    const leaderboard = [];
    let rank = 1;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const rating = data[ratingField] || 1000;
      
      if (rating > 100) {
        leaderboard.push({
          rank,
          uid: doc.id,
          displayName: data.displayName || 'Anonymous',
          photoURL: data.photoURL || null,
          rating,
          country: data.country || null,
        });
        rank++;
      }
    }

    return NextResponse.json({
      success: true,
      event,
      leaderboard,
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
