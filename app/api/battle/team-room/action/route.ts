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
    const body = await request.json();
    const { roomId, userId, action } = body;

    if (!roomId || !userId || !action) {
      return NextResponse.json(
        { success: false, message: 'Room ID, User ID, and Action are required' },
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

    if (action === 'cancel') {
      if (roomData.createdBy !== userId) {
        return NextResponse.json({ success: false, message: 'Only creator can cancel' });
      }
      await roomRef.update({ status: 'cancelled' });
      return NextResponse.json({ success: true, message: 'Room cancelled' });
    }

    if (action === 'start') {
      if (roomData.createdBy !== userId) {
        return NextResponse.json({ success: false, message: 'Only creator can start' });
      }

      const teamA = roomData.teamA || [];
      const teamB = roomData.teamB || [];
      const teamSize = roomData.teamSize || 2;

      if (teamA.filter(p => p.userId).length < teamSize || teamB.filter(p => p.userId).length < teamSize) {
        return NextResponse.json({ success: false, message: 'Not enough players' });
      }

      let scrambleData;
      try {
        scrambleData = generateScramble(roomData.event || '333', 5);
      } catch (error) {
        return NextResponse.json({ success: false, message: 'Failed to generate scrambles' });
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const allPlayers = [...teamA.filter(p => p.userId), ...teamB.filter(p => p.userId)].map(p => p.userId);

      const battleData = {
        battleId: '',
        battleName: roomData.battleName || `Team Battle ${teamSize}v${teamSize}`,
        battleType: 'teamBattle',
        event: roomData.event || '333',
        scrambleId: scrambleData.scrambleId,
        scrambles: scrambleData.scrambles,
        currentScrambleIndex: 0,
        currentRound: 1,
        createdBy: userId,
        status: 'waiting',
        winner: null,
        visibility: roomData.visibility || 'public',
        format: roomData.format || 'firstTo3',
        winsRequired: roomData.winsRequired || 3,
        scores: { player1: 0, player2: 0 },
        allowSpectators: true,
        spectators: [],
        startTime: null,
        createdAt: now,
        lastActivityAt: now,
        startedAt: null,
        completedAt: null,
        roundCount: roomData.roundCount || 5,
        teamSize: teamSize,
        teamA: teamA.filter(p => p.userId),
        teamB: teamB.filter(p => p.userId),
        players: allPlayers,
        playersJoined: allPlayers,
      };

      const battleRef = db.collection('battles').doc(roomId + '_battle');
      const battleId = battleRef.id;
      await battleRef.set({ ...battleData, battleId });

      await roomRef.update({
        status: 'started',
        battleId: battleId,
        startedAt: now,
      });

      return NextResponse.json({ success: true, battleId, message: 'Battle started!' });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' });
  } catch (error) {
    console.error('Team room action error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to perform action: ' + error.message },
      { status: 500 }
    );
  }
}
