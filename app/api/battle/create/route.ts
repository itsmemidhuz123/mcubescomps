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
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { success: false, message: 'Invalid request body' },
        { status: 400 }
      );
    }

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

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!event || typeof event !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Event is required' },
        { status: 400 }
      );
    }

    let winsReq = winsRequired;
    if (format === 'firstTo3') winsReq = 3;
    if (format === 'firstTo5') winsReq = 5;

    let scrambleData;
    try {
      scrambleData = generateScramble(event, roundCount);
    } catch (error) {
      console.error('Scramble generation error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to generate scrambles. Please try again.' },
        { status: 500 }
      );
    }

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
      player1Name: username,
      player2Name: null,
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
      teamA: teamSize > 1 ? [{ userId, username, photoURL }] : [{ userId, username, photoURL }],
      teamB: [],
      players: [userId],
    };

    const db = getAdminDb();
    const battleRef = db.collection('battles').doc(`battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    const battleId = battleRef.id;
    await battleRef.set({ ...battleData, battleId });

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
      { success: false, message: error.message || 'Failed to create battle. Please try again.' },
      { status: 500 }
    );
  }
}
