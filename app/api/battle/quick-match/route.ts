import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where, limit } from 'firebase/firestore';

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

    const queueRef = collection(db, 'matchmakingQueue');
    const oneMinuteAgo = Date.now() - 60000;
    
    const q = query(
      queueRef,
      where('joinedAt', '>', new Date(oneMinuteAgo)),
      limit(10)
    );
    
    const { getDocs } = await import('firebase/firestore');
    const snapshot = await getDocs(q);

    let opponent = null;
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.userId !== userId) {
        opponent = { id: doc.id, ...data };
      }
    });

    if (opponent) {
      const now = serverTimestamp();
      const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await setDoc(doc(db, 'matches', matchId), {
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

      await updateDoc(doc(db, 'matchmakingQueue', userId), {
        matched: true,
        matchId: matchId,
        matchedAt: now,
      }).catch(() => {});

      await updateDoc(doc(db, 'matchmakingQueue', opponent.userId), {
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

    const existingEntry = await getDoc(doc(db, 'matchmakingQueue', userId));
    if (existingEntry.exists()) {
      return NextResponse.json({
        success: true,
        status: 'waiting',
        message: 'Already in queue',
      });
    }

    await setDoc(doc(db, 'matchmakingQueue', userId), {
      userId,
      username: username || 'Player',
      photoURL: photoURL || null,
      event: '333',
      format: 'ao5',
      joinedAt: serverTimestamp(),
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
