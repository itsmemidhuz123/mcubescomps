import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';

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

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
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
      return NextResponse.json(
        { success: false, message: 'Failed to generate scrambles' },
        { status: 500 }
      );
    }

    const now = serverTimestamp();

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

    const battleRef = doc(collection(db, 'battles'), `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    const battleId = battleRef.id;
    await setDoc(battleRef, { ...battleData, battleId });

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
      { success: false, message: 'Failed to create battle: ' + error.message },
      { status: 500 }
    );
  }
}
