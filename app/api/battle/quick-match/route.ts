import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import admin from 'firebase-admin';
import { generateScrambleForBattle, ScrambleError } from '@/services/scrambleService';

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
    const { userId, username, photoURL } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const queueRef = db.collection('matchmakingQueue');

    const oneMinuteAgo = new Date(Date.now() - 60000);
    
    const snapshot = await queueRef
      .where('joinedAt', '>', admin.firestore.Timestamp.fromDate(oneMinuteAgo))
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
      
      // Generate a temporary match ID (battle will be created when both players arrive)
      const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Write to matches collection - this signals both users to navigate to battle
      // NO battle created yet - it will be created when both players arrive at battle page
      await db.collection('matches').doc(matchId).set({
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

      // Update queue entries to mark them as matched
      await queueRef.doc(userId).update({
        matched: true,
        matchId: matchId,
        matchedAt: now,
      }).catch(() => {});

      await queueRef.doc(opponent.userId).update({
        matched: true,
        matchId: matchId,
        matchedAt: now,
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        matchId,
        message: 'Match found!',
      });
    }

    const existingEntry = await queueRef.doc(userId).get();
    if (existingEntry.exists) {
      return NextResponse.json({
        success: true,
        status: 'waiting',
        message: 'Already in queue',
      });
    }

    await queueRef.doc(userId).set({
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
      { success: false, message: 'Failed to join matchmaking' },
      { status: 500 }
    );
  }
}
