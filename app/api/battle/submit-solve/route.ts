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

export async function POST(request) {
  try {
    const body = await request.json();
    const { battleId, userId, time, penalty = 'none', scrambleIndex } = body;

    if (!battleId || userId === undefined || time === undefined) {
      return NextResponse.json(
        { success: false, message: 'Battle ID, User ID, and time are required' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const battleRef = db.collection('battles').doc(battleId);
    const battleDoc = await battleRef.get();

    if (!battleDoc.exists) {
      return NextResponse.json({ success: false, message: 'Battle not found' }, { status: 404 });
    }

    const battleData = battleDoc.data();

    const isPlayer1 = battleData.player1 === userId;
    const isPlayer2 = battleData.player2 === userId;
    const teamA = battleData.teamA || [];
    const teamB = battleData.teamB || [];
    const isTeamPlayer = teamA.some(p => p.userId === userId) || teamB.some(p => p.userId === userId);
    const isTeamBattle = battleData.battleType === 'teamBattle';

    if (!isTeamBattle && !isPlayer1 && !isPlayer2) {
      return NextResponse.json({ success: false, message: 'Not a participant' }, { status: 400 });
    }

    if (isTeamBattle && !isTeamPlayer) {
      return NextResponse.json({ success: false, message: 'Not a participant' }, { status: 400 });
    }

    if (battleData.status !== 'live') {
      return NextResponse.json({ success: false, message: 'Battle is not live' }, { status: 400 });
    }

    const solveData = {
      uid: userId,
      time: time,
      penalty: penalty,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const solvesRef = battleRef.collection('solves').doc(userId);
    const existingSolves = await solvesRef.get();
    
    if (existingSolves.exists) {
      await solvesRef.update({
        solves: admin.firestore.FieldValue.arrayUnion(solveData),
      });
    } else {
      await solvesRef.set({
        solves: [solveData],
      });
    }

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

    return NextResponse.json({ success: true, message: 'Solve submitted!' });
  } catch (error) {
    console.error('Submit solve error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to submit solve: ' + error.message },
      { status: 500 }
    );
  }
}
