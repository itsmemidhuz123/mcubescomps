'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, orderBy, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Loader2, Sword, Users, Clock, ArrowLeft, Copy, Check, Pause } from 'lucide-react';
import { BATTLE_EVENTS } from '../../lib/battleUtils';
import { BATTLE_STATES } from '../../lib/battleUtils';

export default function MyBattlesPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [myBattles, setMyBattles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirect=/my-battles');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    loadMyBattles();
  }, []);

  const loadMyBattles = async () => {
    if (!user) return;

    try {
      const q = query(
        collection(db, 'battles'),
        where('createdBy', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const battles = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      
      const oneDayMs = 24 * 60 * 60 * 1000;
      const now = Date.now();
      
      const filteredBattles = battles.filter((battle) => {
        if (battle.status === 'expired') {
          const createdAt = battle.createdAt?.toDate?.() || new Date(battle.createdAt?._seconds * 1000);
          const battleAge = now - createdAt.getTime();
          return battleAge <= oneDayMs * 7;
        }
        return true;
      });
      
      setMyBattles(filteredBattles);
    } catch (error) {
      console.error('Error loading my battles:', error);
    } finally {
      setLoading(false);
    }
  };

  const discontinueBattle = async (battleId) => {
    if (!confirm('Are you sure you want to discontinue this battle?')) return;

    try {
      await updateDoc(doc(db, 'battles', battleId), {
        status: 'cancelled',
      });
      await loadMyBattles();
    } catch (error) {
      console.error('Error discontinuing battle:', error);
      alert('Failed to discontinue battle');
    }
  };

  const copyBattleLink = (battleId) => {
    const link = `${window.location.origin}/battle/${battleId}`;
    navigator.clipboard.writeText(link);
    alert('Link copied to clipboard!');
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/battle')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sword className="w-6 h-6 text-red-500" />
            My Battles
          </h1>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
            </div>
          ) : myBattles.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No battles created</p>
              <p className="text-sm">Create a battle to get started!</p>
            </div>
          ) : (
            myBattles.map((battle) => (
              <Card key={battle.id} className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {BATTLE_EVENTS.find(e => e.id === battle.event)?.icon} {getCurrentEventName(battle.event)}
                      <Badge
                        variant={
                          battle.status === 'live' ? 'default' :
                          battle.status === 'completed' ? 'secondary' :
                          battle.status === 'waiting' ? 'default' :
                          battle.status === 'cancelled' ? 'destructive' :
                          battle.status === 'expired' ? 'destructive' : 'secondary'
                        }
                      >
                        {battle.status.toUpperCase()}
                      </Badge>
                    </CardTitle>
                    {battle.player2 && (
                      <div className="flex items-center gap-1 text-sm text-zinc-400">
                        <Users className="w-4 h-4" />
                        <span>2</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-zinc-400">
                      Created: {battle.createdAt?.toDate?.()
                        ? new Date(battle.createdAt.seconds * 1000).toLocaleString()
                        : 'Just now'}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyBattleLink(battle.id)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    {battle.status === 'waiting' && (
                      <>
                        <Button
                          onClick={() => router.push(`/battle/${battle.id}`)}
                          className="flex-1 bg-green-600 hover:bg-green-500"
                          size="sm"
                        >
                          Rejoin
                        </Button>
                        <Button
                          onClick={() => discontinueBattle(battle.id)}
                          variant="outline"
                          className="flex-1"
                          size="sm"
                        >
                          Discontinue
                        </Button>
                      </>
                    )}
                    {battle.status === 'completed' && (
                      <Button
                        onClick={() => router.push(`/battle/${battle.id}`)}
                        variant="outline"
                        className="flex-1"
                        size="sm"
                      >
                        View Results
                      </Button>
                    )}
                    {battle.status === 'cancelled' && (
                      <Button
                        variant="outline"
                        className="flex-1"
                        size="sm"
                      >
                        Discontinued
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function getCurrentEventName(event) {
  const events = { '333': '3x3', '222': '2x2', '444': '4x4', '555': '5x5', 'pyram': 'Pyraminx', 'skewb': 'Skewb', 'sq1': 'Square-1', 'megaminx': 'Megaminx', 'clock': 'Clock' };
  return events[event] || '3x3';
}
