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

// Helper function to generate scrambles
function generateScramble(event = '333', roundCount = 5) {
  const scrambles = [];
  for (let i = 0; i < roundCount; i++) {
    const chars = 'RURURFRFRFURURF';
    let scramble = '';
    for (let j = 0; j < 20; j++) {
      scramble += chars[Math.floor(Math.random() * chars.length)] + ' ';
    }
    scrambles.push(scramble.trim());
  }
  return {
    scrambleId: `scramble_${Date.now()}`,
    scrambles: scrambles,
    event: event
  };
}

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid request body' },
        { status: 400 }
      );
    }
    
    const { userId, username, photoURL } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    const queueRef = getAdminDb().collection('matchmakingQueue');
    const oneMinuteAgo = Date.now() - 60000;
    
    const snapshot = await queueRef
      .where('joinedAt', '>', admin.firestore.Timestamp.fromMillis(oneMinuteAgo))
      .limit(10)
      .get();

    let opponent = null;
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.userId !== userId) {
        opponent = { id: doc.id, ...data };
      }
    });

    if (opponent) {
      const now = admin.firestore.FieldValue.serverTimestamp();
      const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await getAdminDb().collection('matches').doc(matchId).set({
        matchId: matchId,
        createdAt: now,
        player1: userId,
        player2: opponent.userId,
        player1Name: username || 'Player',
        player2Name: opponent.username,
        player1PhotoURL: photoURL || null,
        player2PhotoURL: opponent.photoURL || null,
        battleCreated: false,
        player1Joined: false,
        player2Joined: false,
      });

      try {
        await getAdminDb().collection('matchmakingQueue').doc(userId).update({
          matched: true,
          matchId: matchId,
          matchedAt: now,
        });
      } catch {}

      try {
        await getAdminDb().collection('matchmakingQueue').doc(opponent.userId).update({
          matched: true,
          matchId: matchId,
          matchedAt: now,
        });
      } catch {}

      return NextResponse.json({
        success: true,
        matchId,
        message: 'Match found!',
      });
    }

    const existingEntry = await getAdminDb().collection('matchmakingQueue').doc(userId).get();
    if (existingEntry.exists) {
      return NextResponse.json({
        success: true,
        status: 'waiting',
        message: 'Already in queue',
      });
    }

    await getAdminDb().collection('matchmakingQueue').doc(userId).set({
      userId,
      username: username || 'Player',
      photoURL: photoURL || null,
      event: '333',
      format: 'ao5',
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      status: 'waiting',
      message: 'Added to matchmaking queue',
    });
  } catch (error) {
    console.error('Quick match error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to join matchmaking: ' + error.message },
      { status: 500 }
    );
  }
}
