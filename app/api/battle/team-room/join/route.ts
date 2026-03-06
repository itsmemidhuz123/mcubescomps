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
      return NextResponse.json(
        { success: false, message: 'Room not found' },
        { status: 404 }
      );
    }

    const roomData = roomDoc.data();

    if (roomData.status !== 'waiting') {
      return NextResponse.json(
        { success: false, message: 'Room is no longer available' },
        { status: 400 }
      );
    }

    // Check if user already in room
    if (roomData.players?.includes(userId)) {
      return NextResponse.json({
        success: true,
        message: 'Already in room',
        roomId: roomId,
      });
    }

    const teamSize = roomData.teamSize || 1;
    const teamA = roomData.teamA || [];
    const teamB = roomData.teamB || [];
    const players = roomData.players || [];
    const playersJoined = roomData.playersJoined || [];

    // Add user to first available slot in Team B (alternatively)
    let updatedTeamA = [...teamA];
    let updatedTeamB = [...teamB];
    let addedToTeam = null;

    // Try to add to Team B first (since Team A has creator)
    const emptySlotInB = updatedTeamB.findIndex(slot => !slot.userId);
    if (emptySlotInB !== -1) {
      updatedTeamB[emptySlotInB] = {
        userId: userId,
        username: username || 'Player',
        photoURL: photoURL || null,
        joined: true,
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      addedToTeam = 'B';
    } else {
      // If Team B is full, try Team A
      const emptySlotInA = updatedTeamA.findIndex(slot => !slot.userId);
      if (emptySlotInA !== -1) {
        updatedTeamA[emptySlotInA] = {
          userId: userId,
          username: username || 'Player',
          photoURL: photoURL || null,
          joined: true,
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        addedToTeam = 'A';
      }
    }

    if (!addedToTeam) {
      return NextResponse.json(
        { success: false, message: 'Room is full' },
        { status: 400 }
      );
    }

    // Update room
    await roomRef.update({
      teamA: updatedTeamA,
      teamB: updatedTeamB,
      players: [...players, userId],
      playersJoined: [...playersJoined, userId],
      lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      roomId: roomId,
      team: addedToTeam,
      message: `Joined Team ${addedToTeam}`,
    });
  } catch (error) {
    console.error('Join team room error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Failed to join room: ' + errorMessage },
      { status: 500 }
    );
  }
}
