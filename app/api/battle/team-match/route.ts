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

    const privateKey = privateKeyRaw.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey })
    });
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
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid request body' },
        { status: 400 }
      );
    }
    
    const { userId, username, photoURL, teamSize = 2, event = '333' } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    const queueRef = getAdminDb().collection('matchmakingQueue');
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    const snapshot = await queueRef
      .where('joinedAt', '>', admin.firestore.Timestamp.fromMillis(fiveMinutesAgo))
      .where('teamBattle', '==', true)
      .where('teamSize', '==', teamSize)
      .where('event', '==', event)
      .limit(30)
      .get();

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
      const now = admin.firestore.FieldValue.serverTimestamp();

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

      await getAdminDb().collection('matches').doc(matchId).set({
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
      try {
        updateQueuePromises.push(getAdminDb().collection('matchmakingQueue').doc(userId).update({
          matched: true, matchId: matchId, matchedAt: now
        }));
      } catch {}

      for (const player of selectedOpponents) {
        try {
          updateQueuePromises.push(getAdminDb().collection('matchmakingQueue').doc(player.userId).update({
            matched: true, matchId: matchId, matchedAt: now
          }));
        } catch {}
      }

      await Promise.all(updateQueuePromises);

      return NextResponse.json({ success: true, matchId, teamSize, event, message: 'Team match found!' });
    }

    const existingEntry = await getAdminDb().collection('matchmakingQueue').doc(userId).get();
    if (existingEntry.exists) {
      const existingData = existingEntry.data();
      if (existingData.teamBattle && existingData.teamSize === teamSize && existingData.event === event) {
        return NextResponse.json({ success: true, status: 'waiting', message: 'Already in team queue' });
      }
    }

    await getAdminDb().collection('matchmakingQueue').doc(userId).set({
      userId,
      username: username || 'Player',
      photoURL: photoURL || null,
      event: event,
      format: 'bo3',
      teamBattle: true,
      teamSize: teamSize,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
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
