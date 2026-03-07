import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, arrayUnion, setDoc } from 'firebase/firestore';

export async function POST(request) {
  try {
    const body = await request.json();
    const { roomId, userId, username, photoURL } = body;

    if (!roomId || !userId) {
      return NextResponse.json(
        { success: false, message: 'Room ID and User ID are required' },
        { status: 400 }
      );
    }

    const roomRef = doc(db, 'teamRooms', roomId);
    const roomDoc = await getDoc(roomRef);

    if (!roomDoc.exists()) {
      return NextResponse.json({ success: false, message: 'Room not found' });
    }

    const roomData = roomDoc.data();

    if (roomData.status !== 'waiting') {
      return NextResponse.json({ success: false, message: 'Room already started or cancelled' });
    }

    const teamA = roomData.teamA || [];
    const teamB = roomData.teamB || [];
    const teamSize = roomData.teamSize || 2;

    const alreadyInTeamA = teamA.some(p => p.userId === userId);
    const alreadyInTeamB = teamB.some(p => p.userId === userId);

    if (alreadyInTeamA || alreadyInTeamB) {
      return NextResponse.json({ success: true, message: 'Already in room' });
    }

    const teamASlots = teamA.filter(p => !p.userId);
    const teamBSlots = teamB.filter(p => !p.userId);

    if (teamASlots.length > 0) {
      const slotIndex = teamA.findIndex(p => !p.userId);
      teamA[slotIndex] = {
        userId,
        username: username || 'Player',
        photoURL: photoURL || null,
        joined: true,
        joinedAt: new Date().toISOString(),
      };
      await updateDoc(roomRef, {
        teamA: teamA,
        players: arrayUnion(userId),
        lastActivityAt: serverTimestamp(),
      });
    } else if (teamBSlots.length > 0) {
      const slotIndex = teamB.findIndex(p => !p.userId);
      teamB[slotIndex] = {
        userId,
        username: username || 'Player',
        photoURL: photoURL || null,
        joined: true,
        joinedAt: new Date().toISOString(),
      };
      await updateDoc(roomRef, {
        teamB: teamB,
        players: arrayUnion(userId),
        lastActivityAt: serverTimestamp(),
      });
    } else {
      return NextResponse.json({ success: false, message: 'Room is full' });
    }

    const fullTeamA = teamA.filter(p => p.userId).length >= teamSize;
    const fullTeamB = teamB.filter(p => p.userId).length >= teamSize;

    if (fullTeamA && fullTeamB) {
      await updateDoc(roomRef, { status: 'ready' });
    }

    return NextResponse.json({ success: true, message: 'Joined room successfully' });
  } catch (error) {
    console.error('Join team room error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to join team room: ' + error.message },
      { status: 500 }
    );
  }
}
