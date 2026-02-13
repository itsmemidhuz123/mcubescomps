'use client'

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trophy, Medal } from 'lucide-react';
import { getEventName, getEventIcon } from '@/lib/wcaEvents';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function LeaderboardPage() {
  const router = useRouter();
  const params = useParams();
  const [competition, setCompetition] = useState(null);
  const [leaderboards, setLeaderboards] = useState({});
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.competitionId) {
      fetchCompetition();
    }
  }, [params.competitionId]);

  async function fetchCompetition() {
    try {
      const compDoc = await getDoc(doc(db, 'competitions', params.competitionId));
      if (compDoc.exists()) {
        const data = compDoc.data();
        setCompetition({ id: compDoc.id, ...data });
        setSelectedEvent(data.events?.[0]);
        
        // Fetch leaderboards for all events
        await fetchLeaderboards(data.events);
      }
    } catch (error) {
      console.error('Failed to fetch competition:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLeaderboards(events) {
    try {
      const leaderboardData = {};

      for (const eventId of events) {
        // Get all results for this event
        const resultsQuery = query(
          collection(db, 'results'),
          where('competitionId', '==', params.competitionId),
          where('eventId', '==', eventId)
        );

        const resultsSnapshot = await getDocs(resultsQuery);
        const results = [];

        for (const resultDoc of resultsSnapshot.docs) {
          const resultData = resultDoc.data();
          
          // Fetch user data
          const userDoc = await getDoc(doc(db, 'users', resultData.userId));
          const userData = userDoc.exists() ? userDoc.data() : {};

          results.push({
            ...resultData,
            userName: userData.displayName || 'Unknown',
            wcaStyleId: userData.wcaStyleId || 'N/A',
            country: userData.country || 'Unknown',
            photoURL: userData.photoURL
          });
        }

        // Sort by average (DNF at bottom), then by best single
        results.sort((a, b) => {
          if (a.average === 'DNF' && b.average !== 'DNF') return 1;
          if (a.average !== 'DNF' && b.average === 'DNF') return -1;
          if (a.average === 'DNF' && b.average === 'DNF') {
            // Both DNF, sort by best single
            if (a.bestSingle === Infinity && b.bestSingle === Infinity) return 0;
            if (a.bestSingle === Infinity) return 1;
            if (b.bestSingle === Infinity) return -1;
            return a.bestSingle - b.bestSingle;
          }
          // Both have averages
          if (a.average === b.average) {
            return a.bestSingle - b.bestSingle;
          }
          return a.average - b.average;
        });

        leaderboardData[eventId] = results;
      }

      setLeaderboards(leaderboardData);
    } catch (error) {
      console.error('Failed to fetch leaderboards:', error);
    }
  }

  const formatTime = (ms) => {
    if (ms === Infinity || ms === 'DNF') return 'DNF';
    if (!ms) return '-';
    const seconds = (ms / 1000).toFixed(2);
    return `${seconds}s`;
  };

  const getRankBadge = (index) => {
    if (index === 0) return <Medal className="h-6 w-6 text-yellow-500" />;
    if (index === 1) return <Medal className="h-6 w-6 text-gray-400" />;
    if (index === 2) return <Medal className="h-6 w-6 text-orange-600" />;
    return <span className="text-gray-400 font-bold text-lg">{index + 1}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading leaderboard...</div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Competition not found</div>
      </div>
    );
  }

  const currentLeaderboard = leaderboards[selectedEvent] || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => router.push(`/competition/${params.competitionId}`)}
          className="mb-6 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Competition
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="h-10 w-10 text-yellow-500" />
            <div>
              <h1 className="text-4xl font-bold">{competition.name}</h1>
              <p className="text-gray-400">Leaderboard</p>
            </div>
          </div>

          {/* Event Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {competition.events?.map(eventId => (
              <Button
                key={eventId}
                variant={selectedEvent === eventId ? 'default' : 'outline'}
                onClick={() => setSelectedEvent(eventId)}
                className={selectedEvent === eventId ? 'bg-blue-600' : 'border-gray-600'}
              >
                {getEventIcon(eventId)} {getEventName(eventId)}
              </Button>
            ))}
          </div>
        </div>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-2xl">
              {getEventIcon(selectedEvent)} {getEventName(selectedEvent)} Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentLeaderboard.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                No results yet for this event
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700 hover:bg-gray-700/50">
                      <TableHead className="text-gray-300 w-20">Rank</TableHead>
                      <TableHead className="text-gray-300">User</TableHead>
                      <TableHead className="text-gray-300">WCA ID</TableHead>
                      <TableHead className="text-gray-300">Country</TableHead>
                      <TableHead className="text-gray-300 text-center">Solve 1</TableHead>
                      <TableHead className="text-gray-300 text-center">Solve 2</TableHead>
                      <TableHead className="text-gray-300 text-center">Solve 3</TableHead>
                      <TableHead className="text-gray-300 text-center">Solve 4</TableHead>
                      <TableHead className="text-gray-300 text-center">Solve 5</TableHead>
                      <TableHead className="text-gray-300 text-right font-bold">Average</TableHead>
                      <TableHead className="text-gray-300 text-right">Best</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentLeaderboard.map((entry, index) => (
                      <TableRow key={entry.userId} className="border-gray-700 hover:bg-gray-700/50">
                        <TableCell>
                          <div className="flex items-center justify-center">
                            {getRankBadge(index)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {entry.photoURL && (
                              <img src={entry.photoURL} alt={entry.userName} className="h-8 w-8 rounded-full" />
                            )}
                            <span className="font-medium">{entry.userName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-400">{entry.wcaStyleId}</TableCell>
                        <TableCell className="text-gray-400">{entry.country}</TableCell>
                        {entry.times?.map((time, i) => (
                          <TableCell key={i} className="text-center">
                            {formatTime(time)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-bold text-xl">
                          {entry.average === 'DNF' ? (
                            <Badge variant="destructive">DNF</Badge>
                          ) : (
                            <span className="text-green-400">{formatTime(entry.average)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-blue-400">
                          {formatTime(entry.bestSingle)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default LeaderboardPage;
