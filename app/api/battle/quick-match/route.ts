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
    const { userId, username } = body;

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
      await queueRef.doc(opponent.userId).delete();
      await queueRef.doc(userId).delete();

      let scrambleData;
      try {
        scrambleData = await generateScrambleForBattle({
          event: '333',
          roundCount: 3,
        });
      } catch (scrambleError) {
        return NextResponse.json(
          { success: false, message: 'Failed to generate scrambles' },
          { status: 500 }
        );
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      
      const battleData = {
        battleId: '',
        battleName: 'Quick Battle',
        battleType: 'matchmaking',
        event: '333',
        scrambleId: scrambleData.scrambleId,
        scrambles: scrambleData.scrambles,
        currentScrambleIndex: 0,
        currentRound: 1,
        createdBy: userId,
        player1: userId,
        player2: opponent.userId,
        status: 'waiting',
        winner: null,
        visibility: 'private',
        format: 'bo3',
        winsRequired: 3,
        scores: { player1: 0, player2: 0 },
        allowSpectators: true,
        spectators: [],
        creatorJoined: true,
        opponentJoined: false,
        startTime: null,
        createdAt: now,
        lastActivityAt: now,
        startedAt: null,
        completedAt: null,
        roundCount: 3,
        teamSize: 1,
        teamA: [userId],
        teamB: [opponent.userId],
        players: [userId, opponent.userId],
      };

      const battleRef = await db.collection('battles').add(battleData);
      const battleId = battleRef.id;
      await battleRef.update({ battleId });

      // Write to matches subcollection for both users
      // This is how clients discover their battle
      await db.collection('matchmakingQueue').doc(userId).collection('matches').doc(battleId).set({
        battleId: battleId,
        createdAt: now,
        opponentId: opponent.userId,
        opponentName: opponent.username,
      });

      await db.collection('matchmakingQueue').doc(opponent.userId).collection('matches').doc(battleId).set({
        battleId: battleId,
        createdAt: now,
        opponentId: userId,
        opponentName: username || 'Player',
      });

      return NextResponse.json({
        success: true,
        battleId,
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
      event: '333',
      format: 'bo3',
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
