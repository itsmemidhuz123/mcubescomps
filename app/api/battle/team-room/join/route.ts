import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import admin from 'firebase-admin';

function getAdminDb() {
  if (getApps().length === 0) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!privateKey || privateKey === 'YOUR_PRIVATE_KEY') {
      initializeApp();
    } else {
      privateKey = privateKey.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey
        })
      });
    }
  }
  return admin.firestore();
}

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

    const db = getAdminDb();
    const roomRef = db.collection('teamRooms').doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
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
      await roomRef.update({
        teamA: teamA,
        players: admin.firestore.FieldValue.arrayUnion(userId),
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
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
      await roomRef.update({
        teamB: teamB,
        players: admin.firestore.FieldValue.arrayUnion(userId),
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      return NextResponse.json({ success: false, message: 'Room is full' });
    }

    const fullTeamA = teamA.filter(p => p.userId).length >= teamSize;
    const fullTeamB = teamB.filter(p => p.userId).length >= teamSize;

    if (fullTeamA && fullTeamB) {
      await roomRef.update({ status: 'ready' });
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
