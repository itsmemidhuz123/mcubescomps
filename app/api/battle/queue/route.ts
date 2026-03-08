import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import admin from 'firebase-admin';

function getAdminDb() {
  try {
    if (getApps().length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (projectId && projectId !== 'YOUR_PROJECT_ID' && 
          clientEmail && clientEmail !== 'YOUR_CLIENT_EMAIL' &&
          privateKey && privateKey !== 'YOUR_PRIVATE_KEY') {
        
        const formattedKey = privateKey.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');
        
        initializeApp({
          credential: cert({
            projectId: projectId,
            clientEmail: clientEmail,
            privateKey: formattedKey
          })
        });
        console.log('Firebase Admin initialized with credentials');
      } else {
        initializeApp();
        console.log('Firebase Admin initialized without credentials');
      }
    }
    return admin.firestore();
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
}

export async function DELETE(request) {
  let db;
  try {
    db = getAdminDb();
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    return NextResponse.json(
      { success: false, message: 'Server configuration error. Please contact administrator.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    await db.collection('matchmakingQueue').doc(userId).delete();

    return NextResponse.json({
      success: true,
      message: 'Removed from queue',
    });
  } catch (error) {
    console.error('Leave queue error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to leave queue: ' + error.message },
      { status: 500 }
    );
  }
}
