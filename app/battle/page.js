"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, doc, updateDoc, addDoc, setDoc, serverTimestamp, onSnapshot, deleteDoc, getDocs, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateScrambles } from '@/lib/scrambleService';
import { Button } from '@/components/ui/button';
import { Loader2, Users, MapPin, Crosshair, Zap, Trophy } from 'lucide-react';

export default function BattlePage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [matching, setMatching] = useState(false);
  const [playersOnline, setPlayersOnline] = useState(0);
  const [matchStatus, setMatchStatus] = useState('');
  
  const pollingRef = useRef(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirect=/battle');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    const q = query(collection(db, 'matchmakingQueue'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPlayersOnline(snapshot.size + Math.floor(Math.random() * 50) + 10);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current && pollingRef.current.clear) {
        pollingRef.current.clear();
      }
    };
  }, []);

  const findQuickMatch = async () => {
    if (!user) return;
    
    setMatching(true);
    setMatchStatus('Joining queue...');

    try {
      console.log('Joining queue as:', user.uid);
      
      // Only delete MY old entry, not others'
      await deleteDoc(doc(db, 'matchmakingQueue', user.uid)).catch(() => {});
      
      // Now join fresh
      await setDoc(doc(db, 'matchmakingQueue', user.uid), {
        userId: user.uid,
        username: userProfile?.username || user.displayName || 'Player',
        photoURL: user.photoURL || null,
        event: '333',
        format: 'ao5',
        joinedAt: serverTimestamp(),
        matched: false,
        battleId: null,
        matchInProgress: false,
      });

      console.log('Joined queue, waiting for match...');
      setMatchStatus('Waiting for opponent...');
      waitForMatch();
    } catch (error) {
      console.error('Join queue error:', error);
      setMatchStatus('Failed to join queue. Try again.');
      setMatching(false);
    }
  };

  const waitForMatch = useCallback(() => {
    const queueRef = collection(db, 'matchmakingQueue');
    
    const unsubscribe = onSnapshot(queueRef, async (snapshot) => {
      const allUsers = [];
      
      snapshot.forEach((doc) => {
        allUsers.push({ id: doc.id, ...doc.data() });
      });

      console.log('Queue check:', allUsers.map(u => ({ uid: u.userId, matched: u.matched })));

      const myData = allUsers.find(u => u.userId === user.uid);
      
      // FIRST: Check if battle is ready - redirect immediately
      if (myData?.matched && myData?.battleId) {
        console.log('Found battle:', myData.battleId);
        unsubscribe();
        router.push(`/battle/${myData.battleId}`);
        return;
      }
      
      // SECOND: If WE already have an opponentId, someone beat us to it - just wait for them to create battle
      if (myData?.opponentId && myData?.matchInProgress) {
        console.log('Already have opponent:', myData.opponentId, '- waiting for them to create battle');
        return; // Don't create battle - the other user will create it
      }

      // Find ANY user who is NOT matched and NOT me AND not already matching
      const availableUsers = allUsers.filter(u => 
        !u.matched && 
        !u.matchInProgress &&
        !u.opponentId &&  // Also exclude users who already have an opponent
        u.userId !== user.uid
      );

      console.log('All users in queue:', allUsers.map(u => ({ uid: u.userId, matched: u.matched, inProgress: u.matchInProgress })));
      console.log('Available users:', availableUsers.map(u => u.userId));

      if (availableUsers.length > 0) {
        const opponent = availableUsers[0];
        
        try {
          setMatchStatus('Opponent found! Creating battle...');
          
          // Use transaction to atomically claim opponent - only one user succeeds
          await runTransaction(db, async (t) => {
            const opponentDoc = await t.get(doc(db, 'matchmakingQueue', opponent.userId));
            const myDoc = await t.get(doc(db, 'matchmakingQueue', user.uid));
            
            const oppData = opponentDoc.data();
            const myQueueData = myDoc.data();
            
            // Check if opponent still available
            if (oppData.matched || oppData.matchInProgress || oppData.opponentId) {
              throw new Error('Opponent already matched');
            }
            
            // Also check if WE were already matched by someone else
            if (myQueueData.matchInProgress || myQueueData.opponentId) {
              throw new Error('Already being matched by someone');
            }
            
            // Claim both users atomically
            t.update(doc(db, 'matchmakingQueue', user.uid), { 
              matchInProgress: true, 
              opponentId: opponent.userId 
            });
            t.update(doc(db, 'matchmakingQueue', opponent.userId), { 
              matchInProgress: true, 
              opponentId: user.uid 
            });
          });
          
          // Only the winning transaction reaches here - create battle
          await createSystemBattle(
            [user.uid, opponent.userId],
            [
              { uid: user.uid, username: userProfile?.username || user.displayName || 'Player', photoURL: user.photoURL },
              { uid: opponent.userId, username: opponent.username, photoURL: opponent.photoURL }
            ]
          );
          
        } catch (err) {
          console.log('Transaction failed (lost race):', err.message);
          
          // Clear stale data to allow retry
          try {
            await updateDoc(doc(db, 'matchmakingQueue', user.uid), {
              matchInProgress: false,
              opponentId: null
            });
          } catch (cleanupError) {
            console.log('Failed to cleanup stale data:', cleanupError);
          }
        }
      }
    });
    
    pollingRef.current = { clear: () => unsubscribe() };
  }, [user, userProfile, router]);

  const createSystemBattle = async (playerUids, playerInfo) => {
    try {
      console.log('Creating battle for:', playerUids);
      
      const scrambleData = await generateScrambles('333', 5);
      const now = serverTimestamp();

      const battleData = {
        battleId: '',
        battleName: 'Quick Battle',
        battleType: 'quickBattle',
        event: '333',
        scrambleId: scrambleData.scrambleId,
        scrambles: scrambleData.scrambles,
        currentScrambleIndex: 0,
        currentRound: 1,
        createdBy: playerUids[0],
        player1: playerUids[0],
        player2: playerUids[1],
        player1Name: playerInfo[0].username,
        player2Name: playerInfo[1].username,
        player1PhotoURL: playerInfo[0].photoURL,
        player2PhotoURL: playerInfo[1].photoURL,
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
        teamA: [{ userId: playerUids[0], username: playerInfo[0].username, photoURL: playerInfo[0].photoURL }],
        teamB: [{ userId: playerUids[1], username: playerInfo[1].username, photoURL: playerInfo[1].photoURL }],
        players: playerUids,
        solves: {},
      };

      const battleRef = await addDoc(collection(db, 'battles'), battleData);
      const battleId = battleRef.id;
      await updateDoc(battleRef, { battleId });

      console.log('Battle created:', battleId);

      for (const uid of playerUids) {
        await updateDoc(doc(db, 'matchmakingQueue', uid), {
          matched: true,
          battleId: battleId,
        });
      }

      if (pollingRef.current && pollingRef.current.clear) {
        pollingRef.current.clear();
      }
      
      router.push(`/battle/${battleId}`);
    } catch (error) {
      console.error('Create battle error:', error);
      setMatchStatus('Failed to create battle. Try again.');
      setMatching(false);
    }
  };

  const cleanupQueue = async () => {
    try {
      await deleteDoc(doc(db, 'matchmakingQueue', user.uid)).catch(() => {});
    } catch (e) {}
  };

  const cancelMatch = async () => {
    if (pollingRef.current && pollingRef.current.clear) {
      pollingRef.current.clear();
    }
    
    setMatching(false);
    setMatchStatus('');
    
    await cleanupQueue();
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(239, 68, 68, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(239, 68, 68, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black text-white mb-2 tracking-wider">
            MCUBES <span className="text-red-500">ARENA</span>
          </h1>
          <p className="text-zinc-500 text-lg">BATTLE ROYALE</p>
        </div>

        <div className="relative w-full max-w-2xl mb-8">
          <div className="absolute inset-0 bg-gradient-to-b from-red-500/20 to-transparent rounded-lg blur-3xl" />
          
          <div className="relative bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 backdrop-blur-sm">
            <div className="flex items-center justify-center mb-6">
              <MapPin className="w-6 h-6 text-red-500 mr-2" />
              <span className="text-zinc-400 text-sm uppercase tracking-widest">Battle Zone</span>
            </div>

            <div className="relative h-48 mb-8 bg-zinc-950/50 rounded-lg border border-zinc-800 overflow-hidden">
              <div className="absolute inset-0" style={{
                backgroundImage: `
                  radial-gradient(circle at 30% 50%, rgba(239, 68, 68, 0.15) 0%, transparent 50%),
                  radial-gradient(circle at 70% 50%, rgba(239, 68, 68, 0.1) 0%, transparent 40%)
                `,
              }} />
              
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="relative">
                  <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                  <div className="absolute inset-0 w-4 h-4 bg-red-500 rounded-full animate-ping" />
                </div>
                <p className="text-xs text-zinc-500 mt-2 text-center">YOU ARE HERE</p>
              </div>

              <div className="absolute top-4 left-4 flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-zinc-600" />
                <span className="text-xs text-zinc-600">SECTOR A-1</span>
              </div>

              <div className="absolute bottom-4 right-4">
                <div className="flex gap-1">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="w-2 h-2 bg-zinc-800 rounded-sm" />
                  ))}
                </div>
              </div>
            </div>

            {matching ? (
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-red-500 mx-auto mb-4" />
                <p className="text-white mb-4">{matchStatus}</p>
                <Button
                  variant="outline"
                  onClick={cancelMatch}
                  className="border-zinc-700 text-zinc-400 hover:text-white"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <button
                onClick={findQuickMatch}
                className="group relative w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold text-xl rounded-lg transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <div className="flex items-center justify-center gap-3">
                  <Zap className="w-6 h-6" />
                  <span>QUICK MATCH</span>
                </div>
              </button>
            )}

            <div className="flex items-center justify-center gap-2 mt-4 text-zinc-500">
              <Users className="w-4 h-4" />
              <span className="text-sm">{playersOnline} Players Online</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full max-w-xl">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 text-center opacity-50">
            <Trophy className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-zinc-500 font-medium">1v1 DUEL</p>
            <p className="text-zinc-600 text-xs mt-1">Coming Soon</p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 text-center opacity-50">
            <Users className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-zinc-500 font-medium">2v2 SQUAD</p>
            <p className="text-zinc-600 text-xs mt-1">Coming Soon</p>
          </div>
        </div>

        <p className="text-zinc-600 text-xs mt-8">
          Open in two browser tabs to test battle
        </p>
      </div>
    </div>
  );
}
