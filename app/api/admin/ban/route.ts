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
    const { userId, reason, banDuration, banType, adminUserId } = body;

    if (!userId || !reason || !banDuration || !adminUserId) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const now = new Date();
    
    let expiresAt = null;
    if (banDuration !== 'permanent') {
      const days = parseInt(banDuration);
      expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    }

    const banData = {
      userId,
      reason,
      banType: banType || 'all',
      banDuration,
      bannedAt: admin.firestore.Timestamp.fromDate(now),
      expiresAt: expiresAt ? admin.firestore.Timestamp.fromDate(expiresAt) : null,
      bannedBy: adminUserId,
      active: true,
    };

    const banRef = await db.collection('bannedUsers').add(banData);
    const banId = banRef.id;
    await banRef.update({ banId });

    // Also update the user's profile to reflect ban status
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
      battleBanned: true,
      battleBanReason: reason,
      battleBanExpiresAt: expiresAt ? admin.firestore.Timestamp.fromDate(expiresAt) : null,
      battleBanType: banType || 'all',
    });

    return NextResponse.json({
      success: true,
      banId,
      message: 'User banned successfully',
    });
  } catch (error) {
    console.error('Ban error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to ban user' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const active = searchParams.get('active');
    
    const db = getAdminDb();
    let query = db.collection('bannedUsers').orderBy('bannedAt', 'desc');
    
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    
    const snapshot = await query.limit(100).get();
    const bans = [];
    const now = new Date();
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      // Check if ban is still active
      if (active === 'true') {
        if (data.expiresAt && data.expiresAt.toDate() < now) {
          return; // Skip expired bans
        }
      }
      bans.push({ id: doc.id, ...data });
    });

    return NextResponse.json({ success: true, bans });
  } catch (error) {
    console.error('Get bans error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch bans' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { banId, action, adminUserId } = body;

    if (!banId || !action || !adminUserId) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const banRef = db.collection('bannedUsers').doc(banId);
    const banDoc = await banRef.get();
    
    if (!banDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Ban not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, any> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: adminUserId,
    };

    if (action === 'lift') {
      updateData.active = false;
      updateData.liftedAt = admin.firestore.FieldValue.serverTimestamp();
      updateData.liftedBy = adminUserId;
      
      // Update user profile
      const banData = banDoc.data();
      await db.collection('users').doc(banData.userId).update({
        battleBanned: false,
        battleBanReason: null,
        battleBanExpiresAt: null,
        battleBanType: null,
      });
    }

    await banRef.update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Ban updated successfully',
    });
  } catch (error) {
    console.error('Update ban error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update ban' },
      { status: 500 }
    );
  }
}
