import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import admin from 'firebase-admin';
import { PENALTY, calculateAo5, calculateBestSingle, determineWinner, TOTAL_SCRAMBLES } from '@/lib/battleUtils';

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
    const { battleId, uid, time, penalty = PENALTY.NONE, scrambleIndex, reason } = body;

    if (!battleId || !uid || time === undefined) {
      return NextResponse.json(
        { success: false, message: 'Battle ID, UID, and time are required' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const battleRef = db.collection('battles').doc(battleId);
    const battleDoc = await battleRef.get();

    if (!battleDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Battle not found' },
        { status: 404 }
      );
    }

    const battleData = battleDoc.data();

    if (battleData.status === 'completed') {
      return NextResponse.json(
        { success: false, message: 'Battle is already completed' },
        { status: 400 }
      );
    }

    const solvesRef = battleRef.collection('solves').doc(uid);
    const solvesDoc = await solvesRef.get();

    let existingSolves = [];
    if (solvesDoc.exists) {
      existingSolves = solvesDoc.data().solves || [];
    }

    const expectedIndex = existingSolves.length;
    if (scrambleIndex !== expectedIndex) {
      return NextResponse.json(
        { success: false, message: 'Invalid scramble index' },
        { status: 400 }
      );
    }

    const solveEntry = {
      scrambleIndex,
      time,
      penalty,
      reason: reason || null,
      timestamp: Date.now(),
    };

    existingSolves.push(solveEntry);

    const ao5 = calculateAo5(existingSolves);
    const bestSingle = calculateBestSingle(existingSolves);

    await solvesRef.set({
      uid,
      solves: existingSolves,
      ao5,
      bestSingle,
      lastUpdated: Date.now(),
    });

    const player1SolvesData = await battleRef.collection('solves').doc(battleData.player1).get();
    const player2SolvesData = await battleRef.collection('solves').doc(battleData.player2).get();

    const p1Solves = player1SolvesData.exists ? (player1SolvesData.data().solves || []) : [];
    const p2Solves = player2SolvesData.exists ? (player2SolvesData.data().solves || []) : [];

    const totalSolves = p1Solves.length + p2Solves.length;
    const bothReadyForNext = p1Solves.length === p2Solves.length;

    let battleUpdate: Record<string, unknown> = {};
    let winner = null;

    if (bothReadyForNext && p1Solves.length >= TOTAL_SCRAMBLES) {
      const result = determineWinner(p1Solves, p2Solves);
      
      if (result === 'player1') {
        winner = battleData.player1;
      } else if (result === 'player2') {
        winner = battleData.player2;
      } else {
        winner = 'tie';
      }

      battleUpdate = {
        status: 'completed',
        winner,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    } else if (bothReadyForNext) {
      const nextIndex = (battleData.currentScrambleIndex || 0) + 1;
      battleUpdate = {
        currentScrambleIndex: nextIndex,
      };
    }

    if (Object.keys(battleUpdate).length > 0) {
      await battleRef.update(battleUpdate);
    }

    const currentStatus = battleUpdate.status || battleData.status || 'live';

    return NextResponse.json({
      success: true,
      solves: existingSolves,
      ao5,
      battleStatus: currentStatus,
      winner,
    });
  } catch (error) {
    console.error('Submit solve error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to submit solve' },
      { status: 500 }
    );
  }
}
