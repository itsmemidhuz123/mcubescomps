"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useBattle } from '@/hooks/useBattle';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { ResultCalculator } from '@/lib/battle/ResultCalculator';
import { BATTLE_STATES } from '@/lib/battleUtils';
import { Loader2, Trophy, Crown, User, ArrowLeft, RefreshCw, Home, Share2, Medal } from 'lucide-react';

export default function BattleResultPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const battleId = params.id;

  const {
    battle,
    loading: battleLoading,
    playerRole,
    opponent,
    player1Solves,
    player2Solves,
    getMyAverage,
    getOpponentAverage,
  } = useBattle(battleId, user);

  const [rematching, setRematching] = useState(false);

  const mySolves = playerRole === 'player1' ? player1Solves : playerRole === 'player2' ? player2Solves : [];
  const opponentSolves = playerRole === 'player1' ? player2Solves : playerRole === 'player2' ? player1Solves : [];

  const myAverage = ResultCalculator.calculateAo5(mySolves);
  const opponentAverage = ResultCalculator.calculateAo5(opponentSolves);

  const isWinner = battle?.winner === user?.uid;
  const isLoser = battle?.winner && battle.winner !== user?.uid && battle.winner !== 'tie';
  const isTie = battle?.winner === 'tie';

  const getWinner = () => {
    if (!battle) return null;
    if (battle.winner === battle.player1) return battle.player1Name;
    if (battle.winner === battle.player2) return battle.player2Name;
    return null;
  };

  const handleRematch = async () => {
    if (!user || !battle) return;
    
    setRematching(true);

    try {
      const { generateScrambles } = await import('@/lib/scrambleService');
      const scrambleData = await generateScrambles(battle.event || '333', 5);
      const now = serverTimestamp();

      const newBattleData = {
        battleId: '',
        battleName: 'Quick Battle',
        battleType: 'quickBattle',
        event: battle.event || '333',
        scrambleId: scrambleData.scrambleId,
        scrambles: scrambleData.scrambles,
        currentScrambleIndex: 0,
        currentRound: 1,
        createdBy: user.uid,
        player1: user.uid,
        player2: opponent?.uid,
        player1Name: user.displayName || user.username || 'Player',
        player2Name: opponent?.name || 'Player 2',
        player1PhotoURL: user.photoURL || null,
        player2PhotoURL: opponent?.photoURL || null,
        status: 'waiting',
        winner: null,
        visibility: 'private',
        format: 'ao5',
        winsRequired: 5,
        scores: { player1: 0, player2: 0 },
        allowSpectators: true,
        spectators: [],
        creatorJoined: true,
        opponentJoined: true,
        startTime: null,
        createdAt: now,
        lastActivityAt: now,
        startedAt: null,
        completedAt: null,
        roundCount: 5,
        teamSize: 1,
        teamA: [{ userId: user.uid, username: user.displayName || user.username || 'Player', photoURL: user.photoURL || null }],
        teamB: opponent?.uid ? [{ userId: opponent.uid, username: opponent.name, photoURL: opponent.photoURL }] : [],
        players: [user.uid, opponent?.uid].filter(Boolean),
      };

      const battleRef = await addDoc(collection(db, 'battles'), newBattleData);
      const newBattleId = battleRef.id;
      await updateDoc(battleRef, { battleId: newBattleId });

      router.push(`/battle/${newBattleId}`);
    } catch (error) {
      console.error('Rematch error:', error);
      setRematching(false);
    }
  };

  if (authLoading || battleLoading || !battle) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/battle')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span className="text-zinc-500">BATTLE RESULTS</span>
          </div>

          <Button variant="ghost" size="icon">
            <Share2 className="w-5 h-5" />
          </Button>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 mb-4">
            {isWinner ? (
              <Crown className="w-12 h-12 text-white" />
            ) : isTie ? (
              <Medal className="w-12 h-12 text-white" />
            ) : (
              <Medal className="w-12 h-12 text-zinc-400" />
            )}
          </div>
          
          <h1 className="text-4xl font-black mb-2">
            {isWinner ? 'YOU WIN!' : isTie ? 'IT\'S A TIE!' : 'DEFEAT'}
          </h1>
          
          <p className="text-zinc-500">
            {getWinner() && `Winner: ${getWinner()}`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <ResultCard
            name={battle.player1Name}
            isWinner={battle.winner === battle.player1}
            isPlayer={playerRole === 'player1'}
            solves={mySolves}
            average={playerRole === 'player1' ? myAverage : opponentAverage}
            formatTime={ResultCalculator.formatTime}
          />
          <ResultCard
            name={battle.player2Name || 'Player 2'}
            isWinner={battle.winner === battle.player2}
            isPlayer={playerRole === 'player2'}
            solves={playerRole === 'player2' ? mySolves : opponentSolves}
            average={playerRole === 'player2' ? myAverage : opponentAverage}
            formatTime={ResultCalculator.formatTime}
          />
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleRematch}
            disabled={rematching || !opponent?.uid}
            className="w-full bg-green-600 hover:bg-green-500"
            size="lg"
          >
            {rematching ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-5 h-5 mr-2" />
            )}
            Rematch
          </Button>
          
          <Button
            onClick={() => router.push('/battle')}
            variant="outline"
            className="w-full border-zinc-700"
            size="lg"
          >
            <Home className="w-5 h-5 mr-2" />
            Back to Arena
          </Button>
        </div>

        <div className="mt-8 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-500 mb-3">BATTLE STATS</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-zinc-600">Event</p>
              <p className="text-white">{battle.event === '333' ? '3x3' : battle.event}</p>
            </div>
            <div>
              <p className="text-zinc-600">Format</p>
              <p className="text-white">Ao5</p>
            </div>
            <div>
              <p className="text-zinc-600">Rounds</p>
              <p className="text-white">{battle.roundCount || 5}</p>
            </div>
            <div>
              <p className="text-zinc-600">Played</p>
              <p className="text-white">
                {new Date(battle.completedAt?.toDate?.() || Date.now()).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ name, isWinner, isPlayer, solves, average, formatTime }) {
  const bestSolve = ResultCalculator.getBestSolve(solves);
  const worstSolve = ResultCalculator.getWorstSolve(solves);

  return (
    <div className={`bg-zinc-900 rounded-xl p-6 border-2 ${
      isWinner ? 'border-yellow-500' : 'border-zinc-800'
    }`}>
      <div className="text-center mb-4">
        <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center ${
          isWinner ? 'bg-yellow-500/20' : 'bg-zinc-800'
        }`}>
          <User className={`w-8 h-8 ${isWinner ? 'text-yellow-500' : 'text-zinc-500'}`} />
        </div>
        
        <div className="flex items-center justify-center gap-2">
          <h3 className="font-bold text-lg">{name}</h3>
          {isWinner && <Crown className="w-5 h-5 text-yellow-500" />}
        </div>
        
        {isPlayer && (
          <span className="text-xs text-zinc-500">(You)</span>
        )}
      </div>

      <div className="text-center mb-4">
        <p className="text-zinc-500 text-sm mb-1">Average</p>
        <p className={`text-3xl font-black ${isWinner ? 'text-yellow-500' : 'text-white'}`}>
          {average ? formatTime(average) : '---'}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-zinc-600 text-xs mb-2">SOLVES</p>
        {[0, 1, 2, 3, 4].map((index) => {
          const solve = solves.find(s => s.scrambleIndex === index);
          const isBest = bestSolve && solve && solve.scrambleIndex === bestSolve.scrambleIndex;
          const isWorst = worstSolve && solve && solve.scrambleIndex === worstSolve.scrambleIndex;
          
          return (
            <div key={index} className="flex justify-between items-center">
              <span className="text-zinc-600 text-xs">{index + 1}.</span>
              <span className={`text-sm font-mono ${
                isBest ? 'text-green-500' : isWorst ? 'text-red-500' : solve ? 'text-white' : 'text-zinc-700'
              }`}>
                {solve ? ResultCalculator.getSolveWithPenalty(solve) : '---'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
