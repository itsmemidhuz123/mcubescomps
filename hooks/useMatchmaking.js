import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const MATCHMAKING_TIMEOUT_MS = 60000; // 1 minute

export function useMatchmaking(user) {
  const [status, setStatus] = useState('idle');
  const [battleId, setBattleId] = useState(null);
  const [error, setError] = useState(null);
  const timeoutRef = useRef(null);
  const unsubscribeRef = useRef(null);

  const leaveQueue = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    if (user?.uid) {
      try {
        await fetch('/api/battle/queue', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid }),
        });
      } catch (err) {
        console.error('Error leaving queue:', err);
      }
    }
    setStatus('idle');
    setBattleId(null);
    setError(null);
  }, [user?.uid]);

  const createBattleFromMatch = async (matchId) => {
    try {
      const response = await fetch('/api/battle/quick-match/create-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      });
      const data = await response.json();
      if (data.success) {
        return data.battleId;
      }
      throw new Error(data.message);
    } catch (err) {
      console.error('Error creating battle:', err);
      throw err;
    }
  };

  const startMatchmaking = useCallback(async () => {
    if (!user?.uid) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    setBattleId(null);
    setStatus('idle');
    setError(null);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    setStatus('searching');

    try {
      const response = await fetch('/api/battle/quick-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          username: user.displayName || 'Player',
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message);
        setStatus('idle');
        return;
      }

      if (data.status === 'waiting') {
        setStatus('waiting');

        const matchesRef = collection(db, 'matches');
        const q = query(matchesRef);
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

        unsubscribeRef.current = onSnapshot(q, async (snapshot) => {
          for (const change of snapshot.docChanges()) {
            if (change.type === 'added' || change.type === 'modified') {
              const matchData = change.doc.data();
              const matchCreatedAt = matchData.createdAt?.toDate?.()?.getTime() || 
                                    matchData.createdAt?._seconds * 1000 || 0;
              
              if (matchCreatedAt < fiveMinutesAgo) {
                continue;
              }
              
              if (matchData.matchId && 
                  !matchData.battleCreated &&
                  (matchData.player1 === user.uid || matchData.player2 === user.uid)) {
                
                try {
                  const battleId = await createBattleFromMatch(matchData.matchId);
                  setBattleId(battleId);
                  setStatus('matched');
                } catch (err) {
                  setError('Failed to create battle');
                  setStatus('idle');
                }
              }
            }
          }
        }, (err) => {
          console.error('Match listener error:', err);
        });

        timeoutRef.current = setTimeout(async () => {
          if (status === 'waiting') {
            await leaveQueue();
            setError('No opponents found. Please try again.');
            setStatus('timeout');
          }
        }, MATCHMAKING_TIMEOUT_MS);
      } else if (data.matchId) {
        try {
          const battleId = await createBattleFromMatch(data.matchId);
          setBattleId(battleId);
          setStatus('matched');
        } catch (err) {
          setError('Failed to create battle');
          setStatus('idle');
        }
      }
    } catch (err) {
      console.error('Matchmaking error:', err);
      setError('Failed to start matchmaking');
      setStatus('idle');
    }
  }, [user, leaveQueue, status]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      leaveQueue();
    };
  }, [leaveQueue]);

  return {
    status,
    battleId,
    error,
    startMatchmaking,
    leaveQueue,
  };
}
