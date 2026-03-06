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
    const { userId, username, teamSize = 2 } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const queueRef = db.collection('matchmakingQueue');

    const oneMinuteAgo = new Date(Date.now() - 60000);
    
    const snapshot = await queueRef
      .where('joinedAt', '>', admin.firestore.Timestamp.fromDate(oneMinuteAgo))
      .where('teamBattle', '==', true)
      .where('teamSize', '==', teamSize)
      .limit(20)
      .get();

    const availablePlayers = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.userId !== userId) {
        availablePlayers.push({ id: doc.id, ...data });
      }
    });

    const playersNeeded = (teamSize * 2) - 1;
    
    if (availablePlayers.length >= playersNeeded) {
      const selectedOpponents = availablePlayers.slice(0, playersNeeded);
      
      // Generate a temporary match ID (battle will be created when players arrive)
      const matchId = `team_match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = admin.firestore.FieldValue.serverTimestamp();
      
      // Assign teams in alternating order: A, B, A, B...
      const teamA = [userId];
      const teamB = [];
      
      for (let i = 0; i < selectedOpponents.length; i++) {
        if (i % 2 === 0) {
          teamA.push(selectedOpponents[i].userId);
        } else {
          teamB.push(selectedOpponents[i].userId);
        }
      }

      // Write to matches collection - signals all players to join
      await db.collection('matches').doc(matchId).set({
        matchId: matchId,
        createdAt: now,
        battleType: 'teamBattle',
        teamSize: teamSize,
        player1: userId,
        player2: selectedOpponents[0].userId,
        players: [userId, ...selectedOpponents.map(p => p.userId)],
        teamA: teamA,
        teamB: teamB,
        player1Name: username || 'Player',
        player2Name: selectedOpponents[0].username || 'Player',
        playersJoined: [userId], // Track who has joined
        battleCreated: false,
      });

      // Update queue entries to mark as matched
      await queueRef.doc(userId).update({
        matched: true,
        matchId: matchId,
        matchedAt: now,
      }).catch(() => {});

      for (const player of selectedOpponents) {
        await queueRef.doc(player.userId).update({
          matched: true,
          matchId: matchId,
          matchedAt: now,
        }).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        matchId,
        teamSize,
        message: 'Team match found!',
      });
    }

    const existingEntry = await queueRef.doc(userId).get();
    if (existingEntry.exists) {
      const existingData = existingEntry.data();
      if (existingData.teamBattle && existingData.teamSize === teamSize) {
        return NextResponse.json({
          success: true,
          status: 'waiting',
          message: 'Already in team queue',
        });
      }
    }

    await queueRef.doc(userId).set({
      userId,
      username: username || 'Player',
      event: '333',
      format: 'bo3',
      teamBattle: true,
      teamSize: teamSize,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      status: 'waiting',
      teamSize,
      message: 'Added to team matchmaking queue',
    });
  } catch (error) {
    console.error('Team match error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to join team matchmaking' },
      { status: 500 }
    );
  }
}
