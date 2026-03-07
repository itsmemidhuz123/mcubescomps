import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, limit, Timestamp, serverTimestamp, arrayUnion } from 'firebase/firestore';

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
    const { userId, username, photoURL, teamSize = 2, event = '333' } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    const queueRef = collection(db, 'matchmakingQueue');
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    const q = query(
      queueRef,
      where('joinedAt', '>', Timestamp.fromMillis(fiveMinutesAgo)),
      where('teamBattle', '==', true),
      where('teamSize', '==', teamSize),
      where('event', '==', event),
      limit(30)
    );

    const snapshot = await getDocs(q);

    const availablePlayers = [];
    snapshot.forEach((docSnap) => {
      const docData = docSnap.data();
      if (docData.userId !== userId) {
        availablePlayers.push({ id: docSnap.id, ...docData });
      }
    });

    const playersNeeded = teamSize * 2;

    if (availablePlayers.length >= playersNeeded - 1) {
      const selectedOpponents = availablePlayers.slice(0, playersNeeded - 1);
      const matchId = `team_match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = serverTimestamp();

      const teamA = [{ userId, username: username || 'Player', photoURL: photoURL || null }];
      const teamB = [];

      for (let i = 0; i < selectedOpponents.length; i++) {
        const player = selectedOpponents[i];
        const playerProfile = {
          userId: player.userId,
          username: player.username || 'Player',
          photoURL: player.photoURL || null,
        };
        if (i % 2 === 0) teamA.push(playerProfile);
        else teamB.push(playerProfile);
      }

      const allPlayerIds = [userId, ...selectedOpponents.map(p => p.userId)];

      await setDoc(doc(db, 'matches', matchId), {
        matchId: matchId,
        createdAt: now,
        battleType: 'teamBattle',
        teamSize: teamSize,
        event: event,
        teamA: teamA,
        teamB: teamB,
        players: allPlayerIds,
        playersJoined: [userId],
        battleCreated: false,
        player1: userId,
        player1Name: username || 'Player',
        player2: selectedOpponents[0]?.userId || null,
        player2Name: selectedOpponents[0]?.username || 'Player',
      });

      const updateQueuePromises = [];
      updateQueuePromises.push(updateDoc(doc(db, 'matchmakingQueue', userId), {
        matched: true, matchId: matchId, matchedAt: now
      }).catch(() => {}));

      for (const player of selectedOpponents) {
        updateQueuePromises.push(updateDoc(doc(db, 'matchmakingQueue', player.userId), {
          matched: true, matchId: matchId, matchedAt: now
        }).catch(() => {}));
      }

      await Promise.all(updateQueuePromises);

      return NextResponse.json({ success: true, matchId, teamSize, event, message: 'Team match found!' });
    }

    const existingEntry = await getDoc(doc(db, 'matchmakingQueue', userId));
    if (existingEntry.exists()) {
      const existingData = existingEntry.data();
      if (existingData.teamBattle && existingData.teamSize === teamSize && existingData.event === event) {
        return NextResponse.json({ success: true, status: 'waiting', message: 'Already in team queue' });
      }
    }

    await setDoc(doc(db, 'matchmakingQueue', userId), {
      userId,
      username: username || 'Player',
      photoURL: photoURL || null,
      event: event,
      format: 'bo3',
      teamBattle: true,
      teamSize: teamSize,
      joinedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true, status: 'waiting', teamSize, event, message: 'Added to team matchmaking queue' });
  } catch (error) {
    console.error('Team match error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to join team matchmaking: ' + error.message },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  return NextResponse.json({ success: true, message: 'Use Firebase console for cleanup' });
}
