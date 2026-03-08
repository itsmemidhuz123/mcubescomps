import { NextResponse } from 'next/server';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function DELETE(request) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    await deleteDoc(doc(db, 'matchmakingQueue', userId));

    return NextResponse.json({
      success: true,
      message: 'Removed from queue',
    });
  } catch (error) {
    console.error('Leave queue error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to leave queue' },
      { status: 500 }
    );
  }
}
