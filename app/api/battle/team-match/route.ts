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

// Cleanup function to delete stale matches (older than 1 hour)
async function cleanupStaleMatches(db) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const matchesRef = db.collection('matches');
  
  try {
    const staleMatches = await matchesRef
      .where('battleType', '==', 'teamBattle')
      .where('createdAt', '<', admin.firestore.Timestamp.fromDate(oneHourAgo))
      .get();
    
    const deletePromises = [];
    staleMatches.forEach((doc) => {
      const data = doc.data();
      // Only delete if battle not created and not full
      if (!data.battleCreated) {
        deletePromises.push(doc.ref.delete());
        console.log('Deleted stale match:', doc.id);
      }
    });
    
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }
  } catch (err) {
    console.log('Cleanup error (non-fatal):', err.message);
  }
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

    const db = getAdminDb();
    const queueRef = db.collection('matchmakingQueue');
    const matchesRef = db.collection('matches');

    // Run cleanup of stale matches first
    await cleanupStaleMatches(db);

    // Search for players in queue - look at last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const snapshot = await queueRef
      .where('joinedAt', '>', admin.firestore.Timestamp.fromDate(fiveMinutesAgo))
      .where('teamBattle', '==', true)
      .where('teamSize', '==', teamSize)
      .where('event', '==', event)
      .limit(30)
      .get();

    const availablePlayers = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.userId !== userId) {
        availablePlayers.push({ id: doc.id, ...data });
      }
    });

    // FULL team requirement: 2v2 = 4, 4v4 = 8, 8v8 = 16
    const playersNeeded = teamSize * 2;
    
    if (availablePlayers.length >= playersNeeded - 1) {
      const selectedOpponents = availablePlayers.slice(0, playersNeeded - 1);
      
      // Generate match ID
      const matchId = `team_match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = admin.firestore.FieldValue.serverTimestamp();
      
      // Build team arrays with player profiles
      const teamA = [];
      const teamB = [];
      
      // Add creator to Team A first
      teamA.push({
        userId: userId,
        username: username || 'Player',
        photoURL: photoURL || null,
      });
      
      // Assign remaining players alternately to teams
      for (let i = 0; i < selectedOpponents.length; i++) {
        const player = selectedOpponents[i];
        const playerProfile = {
          userId: player.userId,
          username: player.username || 'Player',
          photoURL: player.photoURL || null,
        };
        
        if (i % 2 === 0) {
          teamA.push(playerProfile);
        } else {
          teamB.push(playerProfile);
        }
      }

      // Get all player userIds for tracking
      const allPlayerIds = [userId, ...selectedOpponents.map(p => p.userId)];
      const playerNames = [username || 'Player', ...selectedOpponents.map(p => p.username || 'Player')];

      // Write to matches collection
      await matchesRef.doc(matchId).set({
        matchId: matchId,
        createdAt: now,
        battleType: 'teamBattle',
        teamSize: teamSize,
        event: event,
        // Team arrays with full profiles
        teamA: teamA,
        teamB: teamB,
        // Flat arrays for easier querying
        players: allPlayerIds,
        playerNames: playerNames,
        // Track who has joined
        playersJoined: [userId],
        playersJoinedProfiles: [{
          userId: userId,
          username: username || 'Player',
          photoURL: photoURL || null,
        }],
        battleCreated: false,
        // For backwards compatibility
        player1: userId,
        player1Name: username || 'Player',
        player2: selectedOpponents[0]?.userId || null,
        player2Name: selectedOpponents[0]?.username || 'Player',
      });

      // Update queue entries to mark as matched
      const updateQueuePromises = [];
      
      // Update creator
      updateQueuePromises.push(
        queueRef.doc(userId).update({
          matched: true,
          matchId: matchId,
          matchedAt: now,
        }).catch(() => {})
      );

      // Update opponents
      for (const player of selectedOpponents) {
        updateQueuePromises.push(
          queueRef.doc(player.userId).update({
            matched: true,
            matchId: matchId,
            matchedAt: now,
          }).catch(() => {})
        );
      }

      await Promise.all(updateQueuePromises);

      return NextResponse.json({
        success: true,
        matchId,
        teamSize,
        event,
        message: 'Team match found!',
      });
    }

    // Check if user already in queue
    const existingEntry = await queueRef.doc(userId).get();
    if (existingEntry.exists) {
      const existingData = existingEntry.data();
      if (existingData.teamBattle && existingData.teamSize === teamSize && existingData.event === event) {
        return NextResponse.json({
          success: true,
          status: 'waiting',
          message: 'Already in team queue',
        });
      }
    }

    // Add user to queue
    await queueRef.doc(userId).set({
      userId,
      username: username || 'Player',
      photoURL: photoURL || null,
      event: event,
      format: 'bo3',
      teamBattle: true,
      teamSize: teamSize,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      status: 'waiting',
      teamSize,
      event,
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

// GET method to cleanup stale matches (can be called by cron)
export async function GET(request) {
  try {
    const db = getAdminDb();
    await cleanupStaleMatches(db);
    return NextResponse.json({ success: true, message: 'Cleanup completed' });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { success: false, message: 'Cleanup failed' },
      { status: 500 }
    );
  }
}
