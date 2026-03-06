import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import admin from 'firebase-admin';
import { generateScrambleForBattle, ScrambleError } from '@/services/scrambleService';

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
      const allPlayerIds = [userId, ...selectedOpponents.map(p => p.userId)];
      
      for (const player of selectedOpponents) {
        await queueRef.doc(player.userId).delete();
      }
      await queueRef.doc(userId).delete();

      let scrambleData;
      try {
        scrambleData = await generateScrambleForBattle({
          event: '333',
          roundCount: 3,
        });
      } catch (scrambleError) {
        return NextResponse.json(
          { success: false, message: 'Failed to generate scrambles' },
          { status: 500 }
        );
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      
      const teamA = [userId];
      const teamB = [];
      
      for (let i = 0; i < selectedOpponents.length; i++) {
        if (i < teamSize) {
          teamB.push(selectedOpponents[i].userId);
        } else {
          teamA.push(selectedOpponents[i].userId);
        }
      }

      const battleData = {
        battleId: '',
        battleName: `Team Battle ${teamSize}v${teamSize}`,
        battleType: 'teamMatchmaking',
        event: '333',
        scrambleId: scrambleData.scrambleId,
        scrambles: scrambleData.scrambles,
        currentScrambleIndex: 0,
        currentRound: 1,
        createdBy: userId,
        player1: userId,
        player2: teamB[0] || null,
        status: 'waiting',
        winner: null,
        visibility: 'public',
        format: 'bo3',
        winsRequired: 3,
        scores: { player1: 0, player2: 0 },
        allowSpectators: true,
        spectators: [],
        creatorJoined: true,
        opponentJoined: false,
        startTime: null,
        createdAt: now,
        lastActivityAt: now,
        startedAt: null,
        completedAt: null,
        roundCount: 3,
        teamSize: teamSize,
        teamA: teamA,
        teamB: teamB,
        players: allPlayerIds,
      };

      const battleRef = await db.collection('battles').add(battleData);
      const battleId = battleRef.id;
      await battleRef.update({ battleId });

      await db.collection('matchmakingQueue').doc(userId).collection('matches').doc(battleId).set({
        battleId: battleId,
        createdAt: now,
        battleType: 'team',
        teamSize: teamSize,
        teamA: teamA,
        teamB: teamB,
      });

      for (const opponent of selectedOpponents) {
        const opponentTeam = teamB.includes(opponent.userId) ? 'teamB' : 'teamA';
        await db.collection('matchmakingQueue').doc(opponent.userId).collection('matches').doc(battleId).set({
          battleId: battleId,
          createdAt: now,
          battleType: 'team',
          teamSize: teamSize,
          teamA: teamA,
          teamB: teamB,
          yourTeam: opponentTeam,
        });
      }

      return NextResponse.json({
        success: true,
        battleId,
        teamSize,
        teamA,
        teamB,
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
