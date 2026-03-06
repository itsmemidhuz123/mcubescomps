import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useBattleBan(userId) {
  const [isBanned, setIsBanned] = useState(false);
  const [banInfo, setBanInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const userRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const banned = data.battleBanned || false;
        const expiresAt = data.battleBanExpiresAt?.toDate?.();
        const now = new Date();
        
        // Check if ban has expired
        if (banned && expiresAt && expiresAt < now) {
          setIsBanned(false);
          setBanInfo(null);
        } else {
          setIsBanned(banned);
          setBanInfo(banned ? {
            reason: data.battleBanReason || 'No reason provided',
            expiresAt: expiresAt,
            banType: data.battleBanType || 'all',
          } : null);
        }
      }
      setLoading(false);
    }, (error) => {
      console.error('Error checking ban status:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  return { isBanned, banInfo, loading };
}
