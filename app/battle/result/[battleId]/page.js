'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Timer, Trophy, Users, Clock, Flag, X } from 'lucide-react';
import { formatBattleTime, BATTLE_STATES } from '@/lib/battleUtils';
import { BATTLE_EVENTS } from '@/lib/battleUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useBattleBan } from '@/hooks/useBattleBan';

export default function BattleResultPage() {
  const { battleId } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isBanned, banInfo, loading: banLoading } = useBattleBan(user?.uid);
  
  const [battle, setBattle] = useState(null);
  const [solves, setSolves] = useState({});
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  useEffect(() => {
    if (!battleId) return;

    const battleRef = doc(db, 'battles', battleId);
    const battleUnsubscribe = onSnapshot(battleRef, (docSnap) => {
      if (docSnap.exists()) {
        setBattle({ id: docSnap.id, ...docSnap.data() });
      }
      setLoading(false);
    });

    const solvesRef = collection(db, 'battles', battleId, 'solves');
    const solvesQuery = query(solvesRef, orderBy('timestamp', 'asc'));
    const solvesUnsubscribe = onSnapshot(solvesQuery, (snapshot) => {
      const solvesData = {};
      snapshot.forEach((doc) => {
        solvesData[doc.id] = doc.data();
      });
      setSolves(solvesData);
    });

    return () => {
      battleUnsubscribe();
      solvesUnsubscribe();
    };
  }, [battleId]);

  const getCurrentEventName = () => {
    const events = { '333': '3x3', '222': '2x2', '444': '4x4' };
    return events[battle?.event] || '3x3';
  };

  const getPlayerName = (uid) => {
    if (!battle) return 'Player';
    if (battle.player1 === uid) return battle.player1Name || 'Player 1';
    if (battle.player2 === uid) return battle.player2Name || 'Player 2';
    return 'Player';
  };

  const getPlayerSolves = (uid) => {
    return solves[uid]?.solves || [];
  };

  const getRoundWinner = (i) => {
    const p1Solves = getPlayerSolves(battle.player1);
    const p2Solves = getPlayerSolves(battle.player2);
    const p1 = p1Solves[i];
    const p2 = p2Solves[i];

    if (!p1 || !p2) return null;

    const time1 = p1.penalty === -1 ? Infinity : p1.time + (p1.penalty * 1000);
    const time2 = p2.penalty === -1 ? Infinity : p2.time + (p2.penalty * 1000);

    if (time1 === Infinity && time2 === Infinity) return 'tie';
    if (time1 === Infinity) return 'player2';
    if (time2 === Infinity) return 'player1';
    if (time1 < time2) return 'player1';
    if (time2 < time1) return 'player2';
    return 'tie';
  };

  const calculateScore = () => {
    const p1Solves = getPlayerSolves(battle.player1);
    const p2Solves = getPlayerSolves(battle.player2);
    const scores = { player1: 0, player2: 0 };
    const maxScrambles = Math.min(p1Solves.length, p2Solves.length);

    for (let i = 0; i < maxScrambles; i++) {
      const winner = getRoundWinner(i);
      if (winner === 'player1') scores.player1++;
      else if (winner === 'player2') scores.player2++;
    }

    return scores;
  };

  const scores = calculateScore();

  if (loading || !battle) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <h1 className="text-2xl font-bold">{battle.battleName || 'Battle Results'}</h1>
        </div>

        <Card className="bg-zinc-900 border-zinc-800 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              {getPlayerName(battle.player1)} vs {getPlayerName(battle.player2)}
            </CardTitle>
            <p className="text-sm text-zinc-400">
              Event: {getCurrentEventName()}
            </p>
          </CardHeader>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-green-400">{scores.player1}</div>
                <div className="text-sm text-zinc-400 mt-1">Player 1</div>
              </div>
              <div className="text-2xl text-zinc-600">-</div>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-400">{scores.player2}</div>
                <div className="text-sm text-zinc-400 mt-1">Player 2</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 mb-6">
          <CardHeader>
            <CardTitle>Rounds</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {Array.from({ length: 5 }).map((_, i) => {
              const roundWinner = getRoundWinner(i);
              return (
                <div key={i} className="border border-zinc-700 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-zinc-400">Round {i + 1}</span>
                    {roundWinner && (
                      <Badge
                        variant={roundWinner === 'player1' ? 'default' : 'secondary'}
                        className={
                          roundWinner === 'player1'
                            ? 'bg-green-600'
                            : roundWinner === 'player2'
                            ? 'bg-blue-600'
                            : ''
                        }
                      >
                        {roundWinner === 'player1' ? 'Player 1 Won' : roundWinner === 'player2' ? 'Player 2 Won' : 'Tie'}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-zinc-400 mb-1">Player 1</div>
                      <div className="font-mono">
                        {getPlayerSolves(battle.player1)[i]
                          ? formatBattleTime(getPlayerSolves(battle.player1)[i].time)
                          : 'DNF'}
                      </div>
                    </div>
                    <div className="text-center">
                      <Timer className="w-6 h-6 text-zinc-600 mx-auto" />
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-zinc-400 mb-1">Player 2</div>
                      <div className="font-mono">
                        {getPlayerSolves(battle.player2)[i]
                          ? formatBattleTime(getPlayerSolves(battle.player2)[i].time)
                          : 'DNF'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-800 rounded-lg p-4">
                <div className="text-sm text-zinc-400">Player 1 Ao5</div>
                <div className="text-xl font-bold text-green-400">
                  {formatBattleTime(battle.player1?.ao5) || 'DNF'}
                </div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4">
                <div className="text-sm text-zinc-400">Player 2 Ao5</div>
                <div className="text-xl font-bold text-blue-400">
                  {formatBattleTime(battle.player2?.ao5) || 'DNF'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 mb-6">
          <CardHeader>
            <CardTitle>Battle Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-zinc-400">Status</span>
                <Badge>{battle.status}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-zinc-400">Winner</span>
                <span>{battle.winner || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-zinc-400">Created At</span>
                {battle.createdAt && (
                  <span>
                    {battle.createdAt.toDate
                      ? battle.createdAt.toDate().toLocaleString()
                      : battle.createdAt}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            onClick={() => {
              const url = typeof window !== 'undefined' ? window.location.href : '';
              navigator.clipboard.writeText(url);
              alert('URL copied to clipboard!');
            }}
            className="flex-1"
          >
            Share Result
          </Button>
          <Button
            onClick={() => window.location.href = `/battle/${battleId}`}
            variant="outline"
          >
            View Battle
          </Button>
        </div>

        {/* Report Button - allow any battle participant to report opponent */}
        {user && battle && battle.status && (battle.status === 'completed' || battle.status === 'live') && 
         (user.uid === battle.player1 || user.uid === battle.player2) && !reportSubmitted && (
          <div className="mt-4">
            <Button
              onClick={() => setShowReportModal(true)}
              variant="outline"
              className="w-full text-red-400 border-red-800 hover:bg-red-900/20"
            >
              <Flag className="w-4 h-4 mr-2" />
              Report this Battle
            </Button>
          </div>
        )}

        {reportSubmitted && (
          <div className="mt-4 p-3 bg-green-900/20 border border-green-800 rounded-lg text-center text-green-400">
            Report submitted. Thank you!
          </div>
        )}
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="bg-zinc-900 border-zinc-800 w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-500" />
                Report to Game Master!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-zinc-400 mb-4">
                  If you feel that the score of the opponent is suspicious, please report this immediately with options.
                </p>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Reason</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  >
                    <option value="">Select a reason</option>
                    <option value="suspicious_times">Suspicious solve times (too fast)</option>
                    <option value="same_scramble">Same scramble results every time</option>
                    <option value="suspected_cheating">Suspected cheating</option>
                    <option value="timer_manipulation">Timer manipulation</option>
                    <option value="unreal_performance">Unreal performance</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {reportReason === 'other' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Please specify (max 200 characters)</label>
                    <textarea
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value.slice(0, 200))}
                      maxLength={200}
                      className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white h-20 resize-none"
                      placeholder="Describe the issue..."
                    />
                    <p className="text-xs text-zinc-500 mt-1">{reportDescription.length}/200</p>
                  </div>
                )}

                {reportReason !== 'other' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Additional details (optional)</label>
                    <textarea
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value)}
                      maxLength={500}
                      className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white h-20 resize-none"
                      placeholder="Provide any additional context..."
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setShowReportModal(false);
                      setReportReason('');
                      setReportDescription('');
                    }}
                    variant="outline"
                    className="flex-1"
                    disabled={reporting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!reportReason) {
                        alert('Please select a reason');
                        return;
                      }
                      
                      setReporting(true);
                      try {
                        const opponentId = battle.player1 === user.uid ? battle.player2 : battle.player1;
                        
                        await fetch('/api/battle/report', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            battleId,
                            reporterId: user.uid,
                            reportedUserId: opponentId,
                            reason: reportReason,
                            description: reportDescription,
                            battleDetails: {
                              player1: battle.player1,
                              player2: battle.player2,
                              player1Name: battle.player1Name,
                              player2Name: battle.player2Name,
                              scores: battle.scores,
                              event: battle.event,
                              format: battle.format,
                              createdAt: battle.createdAt,
                            },
                          }),
                        });
                        
                        setReportSubmitted(true);
                        setShowReportModal(false);
                        setReportReason('');
                        setReportDescription('');
                      } catch (error) {
                        console.error('Report error:', error);
                        alert('Failed to submit report');
                      } finally {
                        setReporting(false);
                      }
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-500"
                    disabled={reporting}
                  >
                    {reporting ? 'Submitting...' : 'Submit Report'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
