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
    const db = getAdminDb();
    const oneHourMs = 60 * 60 * 1000;
    const now = Date.now();

    const battlesRef = db.collection('battles');
    const snapshot = await battlesRef
      .where('status', '==', 'waiting')
      .get();

    const batch = db.batch();
    let expiredCount = 0;

    snapshot.forEach((doc) => {
      const battle = doc.data();
      const lastActivity = battle.lastActivityAt || battle.createdAt;
      const lastActivityTime = lastActivity?.toDate?.() || new Date(lastActivity?._seconds * 1000);
      const battleAge = now - lastActivityTime.getTime();

      if (battleAge > oneHourMs && !battle.player2) {
        batch.update(doc.ref, { 
          status: 'expired',
          expiredAt: admin.firestore.FieldValue.serverTimestamp()
        });
        expiredCount++;
      }
    });

    if (expiredCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      expiredCount,
      message: `Expired ${expiredCount} battles`
    });
  } catch (error) {
    console.error('Battle cleanup error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to cleanup battles' },
      { status: 500 }
    );
  }
}
