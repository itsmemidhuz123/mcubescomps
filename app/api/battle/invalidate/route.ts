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
    const { battleId, adminUserId, reason } = body;

    if (!battleId || !adminUserId || !reason) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: battleId, adminUserId, reason' },
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

    // Mark battle as invalidated instead of deleting (for audit trail)
    await battleRef.update({
      status: 'invalidated',
      invalidated: true,
      invalidatedReason: reason,
      invalidatedBy: adminUserId,
      invalidatedAt: now,
      updatedAt: now,
    });

    // Delete all solve records for this battle
    const solvesRef = db.collection('battles').doc(battleId).collection('solves');
    const solvesSnapshot = await solvesRef.get();
    
    const deletePromises = [];
    solvesSnapshot.forEach((doc) => {
      deletePromises.push(doc.ref.delete());
    });
    await Promise.all(deletePromises);

    // Log the action in audit logs
    await db.collection('auditLogs').add({
      action: 'BATTLE_INVALIDATED',
      battleId: battleId,
      adminUserId: adminUserId,
      reason: reason,
      originalWinner: battleData.winner,
      originalScores: battleData.scores,
      timestamp: now,
    });

    return NextResponse.json({
      success: true,
      message: 'Battle invalidated and scores deleted successfully',
    });
  } catch (error) {
    console.error('Invalidate battle error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to invalidate battle' },
      { status: 500 }
    );
  }
}
