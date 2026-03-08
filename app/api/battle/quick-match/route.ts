import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminServices() {
  if (getApps().length === 0) {
    initializeApp();
  }
  return {
    auth: getAuth(),
    db: getFirestore()
  };
}

export async function POST(request) {
  let db, auth;
  try {
    const services = getAdminServices();
    db = services.db;
    auth = services.auth;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    return NextResponse.json(
      { success: false, message: 'Server configuration error: ' + error.message },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { userId, username, photoURL } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log('Quick match request:', { userId, username });

    const queueRef = db.collection('matchmakingQueue');
    const oneMinuteAgo = Date.now() - 60000;
    
    const snapshot = await queueRef
      .where('joinedAt', '>', new Date(oneMinuteAgo))
      .limit(10)
      .get();

    console.log('Found players in queue:', snapshot.size);

    let opponent = null;
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log('Queue entry:', doc.id, data);
      if (data.userId !== userId) {
        opponent = { id: doc.id, ...data };
      }
    });

    if (opponent) {
      console.log('Found opponent:', opponent);
      const now = new Date();
      const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await db.collection('matches').doc(matchId).set({
        matchId: matchId,
        createdAt: now,
        player1: userId,
        player2: opponent.userId,
        player1Name: username || 'Player',
        player2Name: opponent.username || 'Player',
        player1PhotoURL: photoURL || null,
        player2PhotoURL: opponent.photoURL || null,
        battleCreated: false,
        player1Joined: false,
        player2Joined: false,
      });

      try {
        await db.collection('matchmakingQueue').doc(userId).update({
          matched: true,
          matchId: matchId,
          matchedAt: now,
        });
      } catch (e) {}

      try {
        await db.collection('matchmakingQueue').doc(opponent.userId).update({
          matched: true,
          matchId: matchId,
          matchedAt: now,
        });
      } catch (e) {}

      return NextResponse.json({
        success: true,
        matchId,
        message: 'Match found!',
      });
    }

    const existingEntry = await db.collection('matchmakingQueue').doc(userId).get();
    if (existingEntry.exists) {
      return NextResponse.json({
        success: true,
        status: 'waiting',
        message: 'Already in queue',
      });
    }

    await db.collection('matchmakingQueue').doc(userId).set({
      userId,
      username: username || 'Player',
      photoURL: photoURL || null,
      event: '333',
      format: 'ao5',
      joinedAt: new Date(),
    });

    console.log('Added to queue:', userId);

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
