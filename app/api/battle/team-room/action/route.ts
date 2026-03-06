import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import admin from 'firebase-admin';
import { generateScrambleForBattle } from '@/services/scrambleService';

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
    const { roomId, userId, action } = body;

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

    // Check permissions
    if (roomData.createdBy !== userId) {
      return NextResponse.json(
        { success: false, message: 'Only room creator can perform this action' },
        { status: 403 }
      );
    }

    if (action === 'cancel') {
      await roomRef.update({
        status: 'cancelled',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return NextResponse.json({
        success: true,
        message: 'Room cancelled',
      });
    }

    if (action === 'extend') {
      const newExpiry = new Date(Date.now() + 30 * 60 * 1000); // Add 30 minutes
      await roomRef.update({
        expiresAt: newExpiry,
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return NextResponse.json({
        success: true,
        message: 'Room extended by 30 minutes',
      });
    }

    if (action === 'start') {
      // Check minimum players (at least 2)
      const playersJoined = roomData.playersJoined?.length || 0;
      if (playersJoined < 2) {
        return NextResponse.json(
          { success: false, message: 'Need at least 2 players to start' },
          { status: 400 }
        );
      }

      // Generate scrambles
      const teamSize = roomData.teamSize || 1;
      const event = roomData.event || '333';
      const roundCount = teamSize * 3; // teamSize * 3 rounds

      let scrambleData;
      try {
        scrambleData = await generateScrambleForBattle({
          event: event,
          roundCount: roundCount,
        });
      } catch (scrambleError) {
        return NextResponse.json(
          { success: false, message: 'Failed to generate scrambles' },
          { status: 500 }
        );
      }

      // Get all player userIds
      const allPlayers = [];
      const teamA = roomData.teamA || [];
      const teamB = roomData.teamB || [];
      
      teamA.forEach(p => { if (p.userId) allPlayers.push(p.userId); });
      teamB.forEach(p => { if (p.userId) allPlayers.push(p.userId); });

      // Create battle
      const now = admin.firestore.FieldValue.serverTimestamp();
      const battleData = {
        battleId: '',
        battleName: roomData.battleName || `Team Battle ${teamSize}v${teamSize}`,
        battleType: 'teamBattle',
        event: event,
        scrambleId: scrambleData.scrambleId,
        scrambles: scrambleData.scrambles,
        currentScrambleIndex: 0,
        currentRound: 1,
        createdBy: userId,
        // Team profiles
        teamA: teamA,
        teamB: teamB,
        players: allPlayers,
        status: 'waiting',
        winner: null,
        visibility: roomData.visibility || 'public',
        format: roomData.format || 'bo3',
        winsRequired: teamSize,
        scores: { player1: 0, player2: 0 },
        teamScores: { teamA: 0, teamB: 0 },
        allowSpectators: true,
        spectators: [],
        creatorJoined: true,
        opponentJoined: true,
        startTime: null,
        createdAt: now,
        lastActivityAt: now,
        startedAt: null,
        completedAt: null,
        roundCount: roundCount,
        teamSize: teamSize,
      };

      const battleRef = await db.collection('battles').add(battleData);
      const battleId = battleRef.id;
      await battleRef.update({ battleId });

      // Update room to started
      await roomRef.update({
        status: 'started',
        battleId: battleId,
        startedAt: now,
      });

      return NextResponse.json({
        success: true,
        battleId: battleId,
        message: 'Battle started!',
      });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Team room action error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to perform action' },
      { status: 500 }
    );
  }
}
