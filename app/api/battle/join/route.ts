import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';

export async function POST(request) {
  try {
    const body = await request.json();
    const { battleId, userId, username, photoURL } = body;

    if (!battleId || !userId) {
      return NextResponse.json(
        { success: false, message: 'Battle ID and User ID are required' },
        { status: 400 }
      );
    }

    const battleRef = doc(db, 'battles', battleId);
    const battleDoc = await getDoc(battleRef);

    if (!battleDoc.exists()) {
      return NextResponse.json({ success: false, message: 'Battle not found' }, { status: 404 });
    }

    const battleData = battleDoc.data();

    if (battleData.status !== 'waiting') {
      return NextResponse.json({ success: false, message: 'Battle already started' }, { status: 400 });
    }

    if (battleData.player1 === userId || battleData.player2 === userId) {
      return NextResponse.json({ success: true, battleId, message: 'Already joined' });
    }

    if (battleData.player2) {
      return NextResponse.json({ success: false, message: 'Battle is full' });
    }

    await updateDoc(battleRef, {
      player2: userId,
      player2Name: username || 'Player 2',
      opponentJoined: true,
      lastActivityAt: serverTimestamp(),
      teamB: [{ userId, username: username || 'Player 2', photoURL: photoURL || null }],
      players: arrayUnion(userId),
    });

    return NextResponse.json({ success: true, battleId, message: 'Joined battle successfully!' });
  } catch (error) {
    console.error('Join battle error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to join battle: ' + error.message },
      { status: 500 }
    );
  }
}
