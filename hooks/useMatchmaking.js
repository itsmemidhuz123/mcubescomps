import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MATCHMAKING_TIMEOUT_MS } from '@/lib/battleUtils';

export function useMatchmaking(user) {
  const [status, setStatus] = useState('idle');
  const [battleId, setBattleId] = useState(null);
  const [error, setError] = useState(null);
  const timeoutRef = useRef(null);
  const unsubscribeRef = useRef(null);

  const leaveQueue = useCallback(async () => {
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
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }
  }, [user?.uid]);

  const startMatchmaking = useCallback(async () => {
    if (!user?.uid) return;

    setStatus('searching');
    setError(null);

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

        unsubscribeRef.current = onSnapshot(
          doc(db, 'matchmakingQueue', user.uid),
          (docSnap) => {
            if (!docSnap.exists()) {
              setStatus('matched');
            }
          },
          (err) => {
            console.error('Queue listener error:', err);
          }
        );

        timeoutRef.current = setTimeout(async () => {
          if (status === 'waiting') {
            await leaveQueue();
            setError('No opponents found. Please try again.');
            setStatus('timeout');
          }
        }, MATCHMAKING_TIMEOUT_MS);
      } else if (data.battleId) {
        setBattleId(data.battleId);
        setStatus('matched');
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
