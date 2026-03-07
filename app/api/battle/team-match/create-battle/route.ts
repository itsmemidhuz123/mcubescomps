import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, serverTimestamp, updateDoc } from 'firebase/firestore';

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
    const { matchId } = body;

    if (!matchId) {
      return NextResponse.json(
        { success: false, message: 'Match ID is required' },
        { status: 400 }
      );
    }

    const matchRef = doc(db, 'matches', matchId);
    const matchDoc = await getDoc(matchRef);

    if (!matchDoc.exists()) {
      return NextResponse.json(
        { success: false, message: 'Match not found' },
        { status: 404 }
      );
    }

    const matchData = matchDoc.data();

    if (matchData.battleCreated) {
      return NextResponse.json({ success: true, battleId: matchData.battleId });
    }

    let scrambleData;
    try {
      scrambleData = generateScramble(matchData.event || '333', 5);
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Failed to generate scrambles' },
        { status: 500 }
      );
    }

    const now = serverTimestamp();
    const teamSize = matchData.teamSize || 2;

    const battleData = {
      battleId: '',
      battleName: `Team Battle ${teamSize}v${teamSize}`,
      battleType: 'teamBattle',
      event: matchData.event || '333',
      scrambleId: scrambleData.scrambleId,
      scrambles: scrambleData.scrambles,
      currentScrambleIndex: 0,
      currentRound: 1,
      createdBy: matchData.players?.[0],
      status: 'waiting',
      winner: null,
      visibility: 'public',
      format: 'firstTo3',
      winsRequired: 3,
      scores: { player1: 0, player2: 0 },
      allowSpectators: true,
      spectators: [],
      startTime: null,
      createdAt: now,
      lastActivityAt: now,
      startedAt: null,
      completedAt: null,
      roundCount: 5,
      teamSize: teamSize,
      teamA: matchData.teamA || [],
      teamB: matchData.teamB || [],
      players: matchData.players || [],
      playersJoined: matchData.playersJoined || [],
    };

    const battleRef = doc(collection(db, 'battles'), matchId + '_team_battle');
    const battleId = battleRef.id;
    await setDoc(battleRef, { ...battleData, battleId });

    await updateDoc(matchRef, {
      battleCreated: true,
      battleId: battleId,
    });

    return NextResponse.json({ success: true, battleId, message: 'Team battle created!' });
  } catch (error) {
    console.error('Create team battle error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create team battle: ' + error.message },
      { status: 500 }
    );
  }
}
