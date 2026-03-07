import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, serverTimestamp, arrayUnion } from 'firebase/firestore';

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

    const battleRef = doc(db, 'battles', battleId);
    const battleDoc = await getDoc(battleRef);

    if (!battleDoc.exists()) {
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
      submittedAt: serverTimestamp(),
    };

    const solvesRef = doc(collection(battleRef, 'solves'), userId);
    const existingSolves = await getDoc(solvesRef);
    
    if (existingSolves.exists()) {
      await updateDoc(solvesRef, {
        solves: arrayUnion(solveData),
      });
    } else {
      await setDoc(solvesRef, {
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

    await updateDoc(battleRef, {
      scores: scores,
      lastActivityAt: serverTimestamp(),
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
