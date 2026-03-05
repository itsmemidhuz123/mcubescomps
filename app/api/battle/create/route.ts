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
      teamSize = 1
    } = body;

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

    const db = getAdminDb();
    const now = admin.firestore.FieldValue.serverTimestamp();

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
      teamA: teamSize > 1 ? [userId] : [userId],
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
    return NextResponse.json(
      { success: false, message: 'Failed to create battle' },
      { status: 500 }
    );
  }
}
