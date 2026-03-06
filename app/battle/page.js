'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Loader2, Sword, Users, Clock, ArrowLeft, Copy, Check, Zap, Eye, X } from 'lucide-react';
import { BATTLE_EVENTS, TEAM_SIZES } from '../../lib/battleUtils';
import { useMatchmaking } from '../../hooks/useMatchmaking';
import { useBattleBan } from '../../hooks/useBattleBan';

export default function BattlePage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { isBanned, banInfo, loading: banLoading } = useBattleBan(user?.uid);
  
  const [selectedEvent, setSelectedEvent] = useState('333');
  const [selectedFormat, setSelectedFormat] = useState('ao5');
  const [selectedTeamSize, setSelectedTeamSize] = useState(1);
  const [selectedVisibility, setSelectedVisibility] = useState('public');
  const [battleName, setBattleName] = useState('');
  const [creating, setCreating] = useState(false);
  const [waitingBattles, setWaitingBattles] = useState([]);
  const [myBattles, setMyBattles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const { status: matchmakingStatus, battleId: matchBattleId, error: matchmakingError, startMatchmaking, leaveQueue } = useMatchmaking(user);

  useEffect(() => {
    if (matchmakingStatus === 'matched' && matchBattleId) {
      router.push(`/battle/${matchBattleId}`);
    }
  }, [matchmakingStatus, matchBattleId, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirect=/battle');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'battles'),
      where('status', '==', 'waiting'),
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const battles = [];
      const oneHourMs = 60 * 60 * 1000;
      const now = Date.now();
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.player1 !== user.uid) {
          const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt?._seconds * 1000);
          const battleAge = now - createdAt.getTime();
          
          if (battleAge <= oneHourMs) {
            battles.push({ id: doc.id, ...data });
          }
        }
      });
      
      setWaitingBattles(battles);
      setLoading(false);
    }, (err) => {
      console.error('Error loading battles:', err);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    loadMyBattles();
  }, []);

  const loadMyBattles = async () => {
    if (!user) return;

    try {
      const q = query(
        collection(db, 'battles'),
        where('createdBy', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(10)
      );

      const snapshot = await getDocs(q);
      const battles = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      
      const oneHourMs = 60 * 60 * 1000;
      const now = Date.now();
      
      const filteredBattles = battles.filter((battle) => {
        if (battle.status === 'expired') {
          return false;
        }
        if (battle.status === 'waiting') {
          const lastActivity = battle.lastActivityAt || battle.createdAt;
          const lastActivityTime = lastActivity?.toDate?.() || new Date(lastActivity?._seconds * 1000);
          const battleAge = now - lastActivityTime.getTime();
          return battleAge <= oneHourMs;
        }
        return true;
      });
      
      setMyBattles(filteredBattles);
    } catch (error) {
      console.error('Error loading my battles:', error);
    }
  };

  const loadWaitingBattles = async () => {
    try {
      const q = query(
        collection(db, 'battles'),
        where('status', '==', 'waiting'),
        where('visibility', '==', 'public'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      
      const snapshot = await getDocs(q);
      const battles = [];
      const oneHourMs = 60 * 60 * 1000;
      const now = Date.now();
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.player1 !== user?.uid) {
          const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt?._seconds * 1000);
          const battleAge = now - createdAt.getTime();
          
          if (battleAge <= oneHourMs) {
            battles.push({ id: doc.id, ...data });
          }
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
          visibility: selectedVisibility,
          allowSpectators: true,
          battleName: battleName,
          format: selectedFormat,
          battleType: 'room',
          teamSize: selectedTeamSize,
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

  const openBattle = async (battleId) => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/battle/open', {
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
        alert(data.message || 'Failed to open battle');
      }
    } catch (error) {
      console.error('Open battle error:', error);
      alert('Failed to open battle');
    }
  };

  const watchBattle = (battleId) => {
    router.push(`/battle/${battleId}?watch=true`);
  };

  const copyBattleLink = (battleId) => {
    const link = `${window.location.origin}/battle/${battleId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (authLoading || banLoading || !user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  // Show ban message if user is banned
  if (isBanned && banInfo) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="bg-zinc-900 border-red-800 w-full max-w-lg">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-900/30 flex items-center justify-center">
              <X className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-red-400 mb-4">Account Restricted</h2>
            <p className="text-zinc-400 mb-4">
              You are temporarily restricted from participating in battles.
            </p>
            <div className="bg-zinc-800 rounded-lg p-4 mb-4 text-left">
              <p className="text-sm text-zinc-400 mb-2"><span className="text-zinc-500">Reason:</span> {banInfo.reason}</p>
              {banInfo.expiresAt && (
                <p className="text-sm text-zinc-400">
                  <span className="text-zinc-500">Expires:</span> {banInfo.expiresAt.toLocaleDateString()}
                </p>
              )}
            </div>
            <Button
              onClick={() => window.location.href = 'mailto:hellobugsentertainment@gmail.com?subject=Battle%20Ban%20Appeal'}
              className="w-full bg-red-600 hover:bg-red-500"
            >
              Contact Admin for Clarification
            </Button>
          </CardContent>
        </Card>
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
            Battle Arena
          </h1>
        </div>

        {/* QUICK BATTLE SECTION */}
        <Card className="bg-zinc-900 border-zinc-800 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Quick Battle
            </CardTitle>
          </CardHeader>
          <CardContent>
            {matchmakingStatus === 'searching' || matchmakingStatus === 'waiting' ? (
              <div className="text-center py-4">
                <Loader2 className="w-8 h-8 animate-spin text-yellow-500 mx-auto mb-4" />
                <p className="text-lg mb-2">
                  {matchmakingStatus === 'searching' ? 'Starting matchmaking...' : 'Searching for opponent...'}
                </p>
                <p className="text-sm text-zinc-400 mb-4">3x3 • Best of 3</p>
                <Button
                  onClick={leaveQueue}
                  variant="outline"
                  className="mx-auto"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-zinc-400 mb-4">Find an opponent instantly!</p>
                <p className="text-sm text-zinc-500 mb-4">3x3 • Best of 3 • 1v1</p>
                <Button
                  onClick={startMatchmaking}
                  disabled={matchmakingStatus === 'timeout'}
                  className="bg-yellow-600 hover:bg-yellow-500"
                  size="lg"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  Quick Battle
                </Button>
                {matchmakingError && (
                  <p className="text-red-400 mt-2 text-sm">{matchmakingError}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* CREATE BATTLE SECTION */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sword className="w-5 h-5" />
                Create Battle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Battle Name (optional)</label>
                <input
                  type="text"
                  value={battleName}
                  onChange={(e) => setBattleName(e.target.value)}
                  placeholder="Example: Evening Practice Battle"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2"
                  maxLength={50}
                />
              </div>

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

              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Format</label>
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2"
                >
                  <option value="ao5">Ao5 (Best of 5 Average)</option>
                  <option value="firstTo3">First to 3 Wins</option>
                  <option value="firstTo5">First to 5 Wins</option>
                  <option value="single">Single Solve</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Team Size</label>
                <select
                  value={selectedTeamSize}
                  onChange={(e) => setSelectedTeamSize(parseInt(e.target.value))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2"
                >
                  {TEAM_SIZES.map((size) => (
                    <option key={size.id} value={size.id}>
                      {size.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Visibility</label>
                <select
                  value={selectedVisibility}
                  onChange={(e) => setSelectedVisibility(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2"
                >
                  <option value="public">Public (shown in Open Battles)</option>
                  <option value="private">Private (link-only)</option>
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
                    Create {selectedTeamSize}v{selectedTeamSize} Battle
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* OPEN BATTLES SECTION */}
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
                   {waitingBattles.map((battle) => {
                     const event = BATTLE_EVENTS.find(e => e.id === battle.event) || BATTLE_EVENTS[0];
                     const isTeamBattle = battle.teamSize && battle.teamSize > 1;
                     const eventIcon = event?.icon || '⚔️';
                     
                     return (
                       <div
                         key={battle.id}
                         className="flex flex-col sm:flex-row sm:items-center justify-between bg-zinc-800 rounded-lg p-3 gap-2 sm:gap-0"
                       >
                         <div className="flex-1 min-w-0">
                           <div className="font-medium flex items-center gap-2 flex-wrap">
                             {battle.battleName || 'Battle'}
                             {isTeamBattle && (
                               <Badge variant="secondary" className="text-xs">
                                 {battle.teamSize}v{battle.teamSize}
                               </Badge>
                             )}
                           </div>
                           <div className="flex flex-wrap items-center gap-2 mt-1">
                             <span className="text-xs text-zinc-400">
                               {eventIcon} {event?.name || '3x3'}
                             </span>
                             {battle.format && (
                               <span className="text-xs text-zinc-500">
                                 • {battle.format === 'ao5' ? 'Ao5' : battle.format === 'firstTo3' ? 'First to 3' : battle.format === 'firstTo5' ? 'First to 5' : battle.format === 'single' ? 'Single' : battle.format}
                               </span>
                             )}
                             <span className="text-xs text-zinc-500">
                               • {new Date(battle.createdAt.seconds * 1000).toLocaleTimeString()}
                             </span>
                           </div>
                         </div>
                         <div className="flex gap-2 w-full sm:w-auto justify-end">
                           <Button
                             variant="ghost"
                             size="icon"
                             onClick={() => copyBattleLink(battle.id)}
                             className="flex-1 sm:flex-none"
                           >
                             {copied ? (
                               <Check className="w-4 h-4 text-green-500" />
                             ) : (
                               <Copy className="w-4 h-4" />
                             )}
                           </Button>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => watchBattle(battle.id)}
                             className="flex-1 sm:flex-none"
                           >
                             <Eye className="w-4 h-4" />
                           </Button>
                           {user?.uid === battle.createdBy ? (
                             <Button
                               onClick={() => openBattle(battle.id)}
                               className="bg-blue-600 hover:bg-blue-500 flex-1 sm:flex-none"
                               size="sm"
                             >
                               Open
                             </Button>
                           ) : (
                             <Button
                               onClick={() => joinBattle(battle.id)}
                               className="bg-green-600 hover:bg-green-500 flex-1 sm:flex-none"
                               size="sm"
                             >
                               Join
                             </Button>
                           )}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               )}
             </CardContent>
          </Card>
        </div>

        {/* MY BATTLES SECTION */}
        <Card className="bg-zinc-900 border-zinc-800 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sword className="w-5 h-5" />
              My Battles
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!user ? (
              <div className="text-center py-4 text-zinc-500">
                <p>Sign in to see your battles</p>
              </div>
            ) : myBattles.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <Sword className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No battles created</p>
                <p className="text-sm">Create a battle to get started!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myBattles.map((battle) => (
                  <div
                    key={battle.id}
                    className="flex items-center justify-between bg-zinc-800 rounded-lg p-3"
                  >
                    <div>
                      <div className="font-medium">
                        {battle.battleName || 'Battle'} • {battle.teamSize || 1}v{battle.teamSize || 1}
                      </div>
                      <div className="text-xs text-zinc-400 flex items-center gap-2">
                        <Badge variant={battle.status === 'live' ? 'default' : 'secondary'}>
                          {battle.status}
                        </Badge>
                        <span>{battle.event}</span>
                        <span>{battle.format}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyBattleLink(battle.id)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      {battle.status === 'waiting' && (
                        <>
                          <Button
                            onClick={() => router.push(`/battle/${battle.id}`)}
                            className="bg-green-600 hover:bg-green-500"
                            size="sm"
                          >
                            Rejoin
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openBattle(battle.id)}
                          >
                            Open
                          </Button>
                        </>
                      )}
                      {battle.status === 'completed' && (
                        <Button
                          onClick={() => router.push(`/battle/result/${battle.id}`)}
                          variant="outline"
                          size="sm"
                        >
                          Results
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
