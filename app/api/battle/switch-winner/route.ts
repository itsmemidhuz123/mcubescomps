import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import admin from 'firebase-admin';

function getAdminDb() {
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!privateKey || privateKey === 'YOUR_PRIVATE_KEY') {
      initializeApp();
    } else {
      privateKey = privateKey.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey })
      });
    }
  }
  return admin.firestore();
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { battleId, newWinnerUid, adminUserId, reason } = body;

    if (!battleId || !newWinnerUid || !adminUserId || !reason) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: battleId, newWinnerUid, adminUserId, reason' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const battleRef = db.collection('battles').doc(battleId);
    const battleDoc = await battleRef.get();

    if (!battleDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Battle not found' },
        { status: 404 }
      );
    }

    const battleData = battleDoc.data();

    // Validate newWinnerUid is one of the players
    if (newWinnerUid !== battleData.player1 && newWinnerUid !== battleData.player2) {
      return NextResponse.json(
        { success: false, message: 'New winner must be one of the battle participants' },
        { status: 400 }
      );
    }

    // Calculate new scores (swap wins)
    const oldWinner = battleData.winner;
    const oldScores = battleData.scores || { player1: 0, player2: 0 };
    const winsRequired = battleData.winsRequired || 3;

    // Determine the loser and swap scores
    const newScores = {
      player1: newWinnerUid === battleData.player1 ? winsRequired : oldScores.player2,
      player2: newWinnerUid === battleData.player2 ? winsRequired : oldScores.player1,
    };

    // Update battle with new winner and scores
    await battleRef.update({
      winner: newWinnerUid,
      scores: newScores,
      status: 'completed',
      winnerSwitched: true,
      originalWinner: oldWinner,
      winnerSwitchReason: reason,
      winnerSwitchedBy: adminUserId,
      winnerSwitchedAt: now,
      updatedAt: now,
    });

    // Log the action in audit logs
    await db.collection('auditLogs').add({
      action: 'WINNER_SWITCHED',
      battleId: battleId,
      adminUserId: adminUserId,
      oldWinner: oldWinner,
      newWinner: newWinnerUid,
      reason: reason,
      oldScores: oldScores,
      newScores: newScores,
      timestamp: now,
    });

    return NextResponse.json({
      success: true,
      message: 'Winner switched successfully',
      newWinner: newWinnerUid,
      newScores: newScores,
    });
  } catch (error) {
    console.error('Switch winner error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to switch winner' },
      { status: 500 }
    );
  }
}
