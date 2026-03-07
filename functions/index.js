const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Helper function to generate scrambles (simplified version)
async function generateScramble(event = '333', roundCount = 5) {
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

// =======================
// QUICK MATCH FUNCTIONS
// =======================

// Quick Match - Join matchmaking queue
exports.quickMatch = functions.https.onCall(async (data, context) => {
  const { userId, username, photoURL } = data;
  
  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
  }

  const queueRef = db.collection('matchmakingQueue');
  const oneMinuteAgo = new Date(Date.now() - 60000);

  const snapshot = await queueRef
    .where('joinedAt', '>', admin.firestore.Timestamp.fromDate(oneMinuteAgo))
    .limit(10)
    .get();

  let opponent = null;
  snapshot.forEach((doc) => {
    const docData = doc.data();
    if (docData.userId !== userId) {
      opponent = { id: doc.id, ...docData };
    }
  });

  if (opponent) {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await db.collection('matches').doc(matchId).set({
      matchId: matchId,
      createdAt: now,
      player1: userId,
      player2: opponent.userId,
      player1Name: username || 'Player',
      player2Name: opponent.username,
      player1PhotoURL: photoURL || null,
      player2PhotoURL: opponent.photoURL || null,
      battleCreated: false,
      player1Joined: false,
      player2Joined: false,
    });

    await queueRef.doc(userId).update({
      matched: true,
      matchId: matchId,
      matchedAt: now,
    }).catch(() => {});

    await queueRef.doc(opponent.userId).update({
      matched: true,
      matchId: matchId,
      matchedAt: now,
    }).catch(() => {});

    return { success: true, matchId, message: 'Match found!' };
  }

  const existingEntry = await queueRef.doc(userId).get();
  if (existingEntry.exists) {
    return { success: true, status: 'waiting', message: 'Already in queue' };
  }

  await queueRef.doc(userId).set({
    userId,
    username: username || 'Player',
    photoURL: photoURL || null,
    event: '333',
    format: 'ao5',
    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, status: 'waiting', message: 'Added to matchmaking queue' };
});

// Create Quick Match Battle
exports.createQuickMatchBattle = functions.https.onCall(async (data, context) => {
  const { matchId } = data;

  if (!matchId) {
    throw new functions.https.HttpsError('invalid-argument', 'Match ID is required');
  }

  const matchRef = db.collection('matches').doc(matchId);
  const matchDoc = await matchRef.get();

  if (!matchDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Match not found');
  }

  const matchData = matchDoc.data();
  const player1 = matchData.player1;
  const player2 = matchData.player2;
  const player1Name = matchData.player1Name || 'Player 1';
  const player2Name = matchData.player2Name || 'Player 2';

  if (!player1 || !player2) {
    throw new functions.https.HttpsError('failed-precondition', 'Players not found in match');
  }

  if (matchData.battleCreated) {
    return { success: true, battleId: matchData.battleId };
  }

  let scrambleData;
  try {
    scrambleData = await generateScramble('333', 5);
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to generate scrambles');
  }

  const now = admin.firestore.FieldValue.serverTimestamp();

  const battleData = {
    battleId: '',
    battleName: 'Quick Battle',
    battleType: 'quickBattle',
    event: '333',
    scrambleId: scrambleData.scrambleId,
    scrambles: scrambleData.scrambles,
    currentScrambleIndex: 0,
    currentRound: 1,
    createdBy: player1,
    player1: player1,
    player2: player2,
    player1Name: player1Name,
    player2Name: player2Name,
    status: 'waiting',
    winner: null,
    visibility: 'private',
    format: 'ao5',
    winsRequired: 5,
    scores: { player1: 0, player2: 0 },
    allowSpectators: true,
    spectators: [],
    creatorJoined: true,
    opponentJoined: true,
    startTime: null,
    createdAt: now,
    lastActivityAt: now,
    startedAt: null,
    completedAt: null,
    roundCount: 5,
    teamSize: 1,
    teamA: [{ userId: player1, username: player1Name, photoURL: matchData.player1PhotoURL || null }],
    teamB: [{ userId: player2, username: player2Name, photoURL: matchData.player2PhotoURL || null }],
    players: [player1, player2],
  };

  const battleRef = await db.collection('battles').add(battleData);
  const battleId = battleRef.id;
  await battleRef.update({ battleId });

  try {
    await matchRef.update({
      battleCreated: true,
      battleId: battleId,
      completedAt: now,
    });
  } catch (updateErr) {
    console.log('Match update skipped:', updateErr.message);
  }

  return { success: true, battleId, message: 'Battle created!' };
});

// =======================
// TEAM BATTLE FUNCTIONS
// =======================

// Team Match - Join team matchmaking
exports.teamMatch = functions.https.onCall(async (data, context) => {
  const { userId, username, photoURL, teamSize = 2, event = '333' } = data;

  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
  }

  const queueRef = db.collection('matchmakingQueue');
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
    const docData = doc.data();
    if (docData.userId !== userId) {
      availablePlayers.push({ id: doc.id, ...docData });
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

    await db.collection('matches').doc(matchId).set({
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
    updateQueuePromises.push(queueRef.doc(userId).update({
      matched: true, matchId: matchId, matchedAt: now
    }).catch(() => {}));

    for (const player of selectedOpponents) {
      updateQueuePromises.push(queueRef.doc(player.userId).update({
        matched: true, matchId: matchId, matchedAt: now
      }).catch(() => {}));
    }

    await Promise.all(updateQueuePromises);

    return { success: true, matchId, teamSize, event, message: 'Team match found!' };
  }

  const existingEntry = await queueRef.doc(userId).get();
  if (existingEntry.exists) {
    const existingData = existingEntry.data();
    if (existingData.teamBattle && existingData.teamSize === teamSize && existingData.event === event) {
      return { success: true, status: 'waiting', message: 'Already in team queue' };
    }
  }

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

  return { success: true, status: 'waiting', teamSize, event, message: 'Added to team matchmaking queue' };
});

// Create Team Match Battle
exports.createTeamMatchBattle = functions.https.onCall(async (data, context) => {
  const { matchId } = data;

  if (!matchId) {
    throw new functions.https.HttpsError('invalid-argument', 'Match ID is required');
  }

  const matchRef = db.collection('matches').doc(matchId);
  const matchDoc = await matchRef.get();

  if (!matchDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Match not found');
  }

  const matchData = matchDoc.data();

  if (matchData.battleCreated) {
    return { success: true, battleId: matchData.battleId };
  }

  let scrambleData;
  try {
    scrambleData = await generateScramble(matchData.event || '333', 5);
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to generate scrambles');
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
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

  const battleRef = await db.collection('battles').add(battleData);
  const battleId = battleRef.id;
  await battleRef.update({ battleId });

  await matchRef.update({
    battleCreated: true,
    battleId: battleId,
  });

  return { success: true, battleId, message: 'Team battle created!' };
});

// Join Team Room
exports.joinTeamRoom = functions.https.onCall(async (data, context) => {
  const { roomId, userId, username, photoURL } = data;

  if (!roomId || !userId) {
    throw new functions.https.HttpsError('invalid-argument', 'Room ID and User ID are required');
  }

  const roomRef = db.collection('teamRooms').doc(roomId);
  const roomDoc = await roomRef.get();

  if (!roomDoc.exists) {
    return { success: false, message: 'Room not found' };
  }

  const roomData = roomDoc.data();

  if (roomData.status !== 'waiting') {
    return { success: false, message: 'Room already started or cancelled' };
  }

  const teamA = roomData.teamA || [];
  const teamB = roomData.teamB || [];
  const teamSize = roomData.teamSize || 2;

  const alreadyInTeamA = teamA.some(p => p.userId === userId);
  const alreadyInTeamB = teamB.some(p => p.userId === userId);

  if (alreadyInTeamA || alreadyInTeamB) {
    return { success: true, message: 'Already in room' };
  }

  const teamASlots = teamA.filter(p => !p.userId);
  const teamBSlots = teamB.filter(p => !p.userId);

  let updateData = {
    players: admin.firestore.FieldValue.arrayUnion(userId),
    lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (teamASlots.length > 0) {
    const slotIndex = teamA.findIndex(p => !p.userId);
    teamA[slotIndex] = {
      userId,
      username: username || 'Player',
      photoURL: photoURL || null,
      joined: true,
      joinedAt: new Date().toISOString(),
    };
    updateData.teamA = teamA;
  } else if (teamBSlots.length > 0) {
    const slotIndex = teamB.findIndex(p => !p.userId);
    teamB[slotIndex] = {
      userId,
      username: username || 'Player',
      photoURL: photoURL || null,
      joined: true,
      joinedAt: new Date().toISOString(),
    };
    updateData.teamB = teamB;
  } else {
    return { success: false, message: 'Room is full' };
  }

  await roomRef.update(updateData);

  const fullTeamA = teamA.filter(p => p.userId).length >= teamSize;
  const fullTeamB = teamB.filter(p => p.userId).length >= teamSize;

  if (fullTeamA && fullTeamB) {
    await roomRef.update({ status: 'ready' });
  }

  return { success: true, message: 'Joined room successfully' };
});

// Team Room Action
exports.teamRoomAction = functions.https.onCall(async (data, context) => {
  const { roomId, userId, action } = data;

  if (!roomId || !userId || !action) {
    throw new functions.https.HttpsError('invalid-argument', 'Room ID, User ID, and Action are required');
  }

  const roomRef = db.collection('teamRooms').doc(roomId);
  const roomDoc = await roomRef.get();

  if (!roomDoc.exists) {
    return { success: false, message: 'Room not found' };
  }

  const roomData = roomDoc.data();

  if (action === 'cancel') {
    if (roomData.createdBy !== userId) {
      return { success: false, message: 'Only creator can cancel' };
    }
    await roomRef.update({ status: 'cancelled' });
    return { success: true, message: 'Room cancelled' };
  }

  if (action === 'start') {
    if (roomData.createdBy !== userId) {
      return { success: false, message: 'Only creator can start' };
    }

    const teamA = roomData.teamA || [];
    const teamB = roomData.teamB || [];
    const teamSize = roomData.teamSize || 2;

    if (teamA.filter(p => p.userId).length < teamSize || teamB.filter(p => p.userId).length < teamSize) {
      return { success: false, message: 'Not enough players' };
    }

    let scrambleData;
    try {
      scrambleData = await generateScramble(roomData.event || '333', 5);
    } catch (error) {
      return { success: false, message: 'Failed to generate scrambles' };
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const allPlayers = [...teamA.filter(p => p.userId), ...teamB.filter(p => p.userId)].map(p => p.userId);

    const battleData = {
      battleId: '',
      battleName: roomData.battleName || `Team Battle ${teamSize}v${teamSize}`,
      battleType: 'teamBattle',
      event: roomData.event || '333',
      scrambleId: scrambleData.scrambleId,
      scrambles: scrambleData.scrambles,
      currentScrambleIndex: 0,
      currentRound: 1,
      createdBy: userId,
      status: 'waiting',
      winner: null,
      visibility: roomData.visibility || 'public',
      format: roomData.format || 'firstTo3',
      winsRequired: roomData.winsRequired || 3,
      scores: { player1: 0, player2: 0 },
      allowSpectators: true,
      spectators: [],
      startTime: null,
      createdAt: now,
      lastActivityAt: now,
      startedAt: null,
      completedAt: null,
      roundCount: roomData.roundCount || 5,
      teamSize: teamSize,
      teamA: teamA.filter(p => p.userId),
      teamB: teamB.filter(p => p.userId),
      players: allPlayers,
      playersJoined: allPlayers,
    };

    const battleRef = await db.collection('battles').add(battleData);
    const battleId = battleRef.id;
    await battleRef.update({ battleId });

    await roomRef.update({
      status: 'started',
      battleId: battleId,
      startedAt: now,
    });

    return { success: true, battleId, message: 'Battle started!' };
  }

  return { success: false, message: 'Invalid action' };
});

// =======================
// BATTLE OPERATIONS
// =======================

// Create Battle (Custom)
exports.createBattle = functions.https.onCall(async (data, context) => {
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
  } = data;

  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
  }

  let winsReq = winsRequired;
  if (format === 'firstTo3') winsReq = 3;
  if (format === 'firstTo5') winsReq = 5;

  let scrambleData;
  try {
    scrambleData = await generateScramble(event, roundCount);
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to generate scrambles');
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

  const battleRef = await db.collection('battles').add(battleData);
  const battleId = battleRef.id;
  await battleRef.update({ battleId });

  return {
    success: true,
    battleId,
    event: scrambleData.event,
    scrambleId: scrambleData.scrambleId,
    scrambles: scrambleData.scrambles,
  };
});

// Join Battle
exports.joinBattle = functions.https.onCall(async (data, context) => {
  const { battleId, userId, username, photoURL } = data;

  if (!battleId || !userId) {
    throw new functions.https.HttpsError('invalid-argument', 'Battle ID and User ID are required');
  }

  const battleRef = db.collection('battles').doc(battleId);
  const battleDoc = await battleRef.get();

  if (!battleDoc.exists) {
    return { success: false, message: 'Battle not found' };
  }

  const battleData = battleDoc.data();

  if (battleData.status !== 'waiting') {
    return { success: false, message: 'Battle already started' };
  }

  if (battleData.player1 === userId || battleData.player2 === userId) {
    return { success: true, battleId, message: 'Already joined' };
  }

  if (battleData.player2) {
    return { success: false, message: 'Battle is full' };
  }

  await battleRef.update({
    player2: userId,
    player2Name: username || 'Player 2',
    opponentJoined: true,
    lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
    teamB: [{ userId, username: username || 'Player 2', photoURL: photoURL || null }],
    players: admin.firestore.FieldValue.arrayUnion(userId),
  });

  return { success: true, battleId, message: 'Joined battle successfully!' };
});

// Start Battle
exports.startBattle = functions.https.onCall(async (data, context) => {
  const { battleId, userId } = data;

  if (!battleId || !userId) {
    throw new functions.https.HttpsError('invalid-argument', 'Battle ID and User ID are required');
  }

  const battleRef = db.collection('battles').doc(battleId);
  const battleDoc = await battleRef.get();

  if (!battleDoc.exists) {
    return { success: false, message: 'Battle not found' };
  }

  const battleData = battleDoc.data();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const isPlayer1 = battleData.player1 === userId;
  const isPlayer2 = battleData.player2 === userId;

  if (!isPlayer1 && !isPlayer2) {
    return { success: false, message: 'Not a participant' };
  }

  if (battleData.battleType === 'teamBattle') {
    const teamA = battleData.teamA || [];
    const teamB = battleData.teamB || [];
    const isTeamPlayer = teamA.some(p => p.userId === userId) || teamB.some(p => p.userId === userId);
    
    if (!isTeamPlayer) {
      return { success: false, message: 'Not a participant' };
    }

    const playersJoined = (battleData.playersJoined || []).length;
    if (playersJoined < 4) {
      return { success: false, message: 'Need at least 4 players to start' };
    }
  } else {
    if (!battleData.player1 || !battleData.player2) {
      return { success: false, message: 'Waiting for opponent' };
    }
  }

  if (battleData.status !== 'waiting') {
    return { success: false, message: 'Battle already started' };
  }

  await battleRef.update({
    status: 'countdown',
    startTime: now,
    startedAt: now,
    lastActivityAt: now,
  });

  return { success: true, message: 'Battle starting!' };
});

// Submit Solve
exports.submitSolve = functions.https.onCall(async (data, context) => {
  const { battleId, userId, scrambleIndex, time, penalty = 'none' } = data;

  if (!battleId || userId === undefined || time === undefined) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }

  const battleRef = db.collection('battles').doc(battleId);
  const battleDoc = await battleRef.get();

  if (!battleDoc.exists) {
    return { success: false, message: 'Battle not found' };
  }

  const battleData = battleDoc.data();

  const isPlayer1 = battleData.player1 === userId;
  const isPlayer2 = battleData.player2 === userId;
  const teamA = battleData.teamA || [];
  const teamB = battleData.teamB || [];
  const isTeamPlayer = teamA.some(p => p.userId === userId) || teamB.some(p => p.userId === userId);
  const isTeamBattle = battleData.battleType === 'teamBattle';

  if (!isTeamBattle && !isPlayer1 && !isPlayer2) {
    return { success: false, message: 'Not a participant' };
  }

  if (isTeamBattle && !isTeamPlayer) {
    return { success: false, message: 'Not a participant' };
  }

  if (battleData.status !== 'live') {
    return { success: false, message: 'Battle is not live' };
  }

  const solveData = {
    uid: userId,
    time: time,
    penalty: penalty,
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await battleRef.collection('solves').doc(userId).set({
    solves: admin.firestore.FieldValue.arrayUnion(solveData),
  });

  const scores = battleData.scores || { player1: 0, player2: 0 };
  
  if (isTeamBattle) {
    const playerTeamA = teamA.some(p => p.userId === userId);
    if (playerTeamA) {
      scores.player1 += 1;
    } else {
      scores.player2 += 1;
    }
  }

  await battleRef.update({
    scores: scores,
    lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, message: 'Solve submitted!' };
});

module.exports = {
  quickMatch: exports.quickMatch,
  createQuickMatchBattle: exports.createQuickMatchBattle,
  teamMatch: exports.teamMatch,
  createTeamMatchBattle: exports.createTeamMatchBattle,
  joinTeamRoom: exports.joinTeamRoom,
  teamRoomAction: exports.teamRoomAction,
  createBattle: exports.createBattle,
  joinBattle: exports.joinBattle,
  startBattle: exports.startBattle,
  submitSolve: exports.submitSolve,
};
