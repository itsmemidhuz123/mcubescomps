'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Loader2, Sword, Users, Clock, ArrowLeft, Copy, Check } from 'lucide-react';
import { BATTLE_EVENTS } from '../../lib/battleUtils';

export default function BattlePage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [selectedEvent, setSelectedEvent] = useState('333');
  const [creating, setCreating] = useState(false);
  const [waitingBattles, setWaitingBattles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirect=/battle');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    loadWaitingBattles();
  }, []);

  const loadWaitingBattles = async () => {
    try {
      const q = query(
        collection(db, 'battles'),
        where('status', '==', 'waiting'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      
      const snapshot = await getDocs(q);
      const battles = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.player1 !== user?.uid) {
          battles.push({ id: doc.id, ...data });
        }
      });
      
      setWaitingBattles(battles);
    } catch (error) {
      console.error('Error loading battles:', error);
    } finally {
      setLoading(false);
    }
  };

  const createBattle = async () => {
    if (!user) return;
    
    setCreating(true);
    try {
      const response = await fetch('/api/battle/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: selectedEvent,
          userId: user.uid,
          roundCount: 5,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/battle/${data.battleId}`);
      } else {
        alert(data.message || 'Failed to create battle');
      }
    } catch (error) {
      console.error('Create battle error:', error);
      alert('Failed to create battle');
    } finally {
      setCreating(false);
    }
  };

  const joinBattle = async (battleId) => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/battle/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          battleId,
          userId: user.uid,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/battle/${battleId}`);
      } else {
        alert(data.message || 'Failed to join battle');
      }
    } catch (error) {
      console.error('Join battle error:', error);
      alert('Failed to join battle');
    }
  };

  const copyBattleLink = (battleId) => {
    const link = `${window.location.origin}/battle/${battleId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sword className="w-6 h-6 text-red-500" />
            1v1 Battle
          </h1>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sword className="w-5 h-5" />
                Create Battle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Event</label>
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2"
                >
                  {BATTLE_EVENTS.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.icon} {event.name}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                onClick={createBattle}
                disabled={creating}
                className="w-full bg-red-600 hover:bg-red-500"
                size="lg"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sword className="w-4 h-4 mr-2" />
                    Create 1v1 Battle
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Open Battles
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                </div>
              ) : waitingBattles.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No open battles</p>
                  <p className="text-sm">Create one to start!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {waitingBattles.map((battle) => (
                    <div
                      key={battle.id}
                      className="flex items-center justify-between bg-zinc-800 rounded-lg p-3"
                    >
                      <div>
                        <div className="font-medium">
                          {BATTLE_EVENTS.find(e => e.id === battle.event)?.icon} 3x3
                        </div>
                        <div className="text-xs text-zinc-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {battle.createdAt?.toDate?.() 
                            ? new Date(battle.createdAt.seconds * 1000).toLocaleTimeString()
                            : 'Just now'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyBattleLink(battle.id)}
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          onClick={() => joinBattle(battle.id)}
                          className="bg-green-600 hover:bg-green-500"
                          size="sm"
                        >
                          Join
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
