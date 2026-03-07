import { NextResponse } from 'next/server';
import { generateScrambleForBattle, ScrambleError } from '@/services/scrambleService';
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
    const { 
      event = '333', 
      userId, 
      roundCount = 5,
      format = 'ao5',
      winsRequired = null,
      visibility = 'private',
      allowSpectators = true,
      battleName = '',
      battleType = 'room',
      teamSize = 1,
      username = 'Player',
      photoURL = null
    } = body;

    const creatorUsername = username || 'Player';
    const creatorPhotoURL = photoURL || null;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!event) {
      return NextResponse.json(
        { success: false, message: 'Event is required' },
        { status: 400 }
      );
    }

    const validFormats = ['ao5', 'firstTo3', 'firstTo5', 'single'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { success: false, message: 'Invalid battle format' },
        { status: 400 }
      );
    }

    const validTeamSizes = [1, 2, 4, 8];
    if (!validTeamSizes.includes(teamSize)) {
      return NextResponse.json(
        { success: false, message: 'Invalid team size' },
        { status: 400 }
      );
    }

    let winsReq = winsRequired;
    if (format === 'firstTo3') winsReq = 3;
    if (format === 'firstTo5') winsReq = 5;
    if (format === 'ao5' || format === 'single') winsReq = null;

    const db = getAdminDb();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const nowDate = new Date();
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 60 * 60 * 1000));

    // For team battles (teamSize > 1), create a waiting room instead of actual battle
    if (teamSize > 1) {
      // Create a waiting room document
      const totalPlayers = teamSize * 2;
      const roomId = `team_room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Get user details from request or use defaults
      const creatorUsername = body.username || 'Player';
      const creatorPhotoURL = body.photoURL || null;
      
      // Create empty team slots
      const teamASlots = Array.from({ length: teamSize }, (_, i) => ({
        userId: i === 0 ? userId : null,
        username: i === 0 ? creatorUsername : null,
        photoURL: i === 0 ? creatorPhotoURL : null,
        joined: i === 0,
        joinedAt: i === 0 ? nowDate.toISOString() : null,
      }));
      
      const teamBSlots = Array.from({ length: teamSize }, () => ({
        userId: null,
        username: null,
        photoURL: null,
        joined: false,
        joinedAt: null,
      }));

      const roomData = {
        roomId: roomId,
        battleType: 'teamRoom',
        teamSize: teamSize,
        event: event,
        format: format,
        roundCount: roundCount,
        winsRequired: winsReq,
        // Team A (creator's team)
        teamA: teamASlots,
        teamB: teamBSlots,
        // Flat arrays for querying
        players: [userId],
        playersJoined: [userId],
        // Creator info
        createdBy: userId,
        creatorUsername: creatorUsername,
        creatorPhotoURL: creatorPhotoURL,
        // Status
        status: 'waiting', // waiting, started, cancelled
        visibility: visibility,
        // Timing
        createdAt: now,
        lastActivityAt: now,
        expiresAt: expiresAt,
        // For open battles display
        battleName: battleName || `${teamSize}v${teamSize} Team Battle`,
      };

      await db.collection('teamRooms').doc(roomId).set(roomData);
      
      return NextResponse.json({
        success: true,
        roomId: roomId,
        teamSize: teamSize,
        event: event,
        message: 'Team battle room created',
      });
    }

    // For 1v1 battles, create the actual battle (original logic)
    let scrambleData;
    try {
      scrambleData = await generateScrambleForBattle({
        event,
        roundCount,
      });
    } catch (scrambleError) {
      console.error('Scramble generation failed:', scrambleError);
      
      const errorMessage = scrambleError instanceof ScrambleError 
        ? scrambleError.message 
        : 'Unable to generate scrambles';

      return NextResponse.json(
        { success: false, message: errorMessage },
        { status: 400 }
      );
    }

    const battleData = {
      battleId: '',
      battleName: battleName || 'Battle vs Opponent',
      battleType: battleType,
      event: scrambleData.event,
      scrambleId: scrambleData.scrambleId,
      scrambles: scrambleData.scrambles,
      currentScrambleIndex: 0,
      currentRound: 1,
      createdBy: userId,
      player1: userId,
      player2: null,
      status: 'waiting',
      winner: null,
      visibility: visibility,
      format: format,
      winsRequired: winsReq,
      scores: { player1: 0, player2: 0 },
      allowSpectators: allowSpectators,
      spectators: [],
      creatorJoined: true,
      opponentJoined: false,
      startTime: null,
      createdAt: now,
      lastActivityAt: now,
      startedAt: null,
      completedAt: null,
      roundCount: roundCount,
      teamSize: teamSize,
      teamA: [{ userId: userId, username: creatorUsername, photoURL: creatorPhotoURL }],
      teamB: [],
      players: [userId],
    };

    const battleRef = await db.collection('battles').add(battleData);
    
    const battleId = battleRef.id;
    await battleRef.update({ battleId });

    return NextResponse.json({
      success: true,
      battleId,
      event: scrambleData.event,
      scrambleId: scrambleData.scrambleId,
      scrambles: scrambleData.scrambles,
    });
  } catch (error) {
    console.error('Battle creation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Failed to create battle: ' + errorMessage },
      { status: 500 }
    );
  }
}
