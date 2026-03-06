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
    const { battleId, reporterId, reportedUserId, reason, description } = body;

    if (!battleId || !reporterId || !reportedUserId || !reason) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const reportData = {
      battleId,
      reporterId,
      reportedUserId,
      reason,
      description: description || '',
      status: 'pending',
      adminAction: null,
      createdAt: now,
      updatedAt: now,
    };

    const reportRef = await db.collection('battleReports').add(reportData);
    const reportId = reportRef.id;
    await reportRef.update({ reportId });

    return NextResponse.json({
      success: true,
      reportId,
      message: 'Report submitted successfully',
    });
  } catch (error) {
    console.error('Report error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to submit report' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    const db = getAdminDb();
    let query = db.collection('battleReports').orderBy('createdAt', 'desc');
    
    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }
    
    const snapshot = await query.limit(100).get();
    const reports = [];
    
    snapshot.forEach((doc) => {
      reports.push({ id: doc.id, ...doc.data() });
    });

    return NextResponse.json({ success: true, reports });
  } catch (error) {
    console.error('Get reports error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
