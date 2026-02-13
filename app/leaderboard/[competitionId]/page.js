'use client'

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Trophy, Medal, Search, Filter } from 'lucide-react';
import { getEventName, getEventIcon } from '@/lib/wcaEvents';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function LeaderboardPage() {
  const router = useRouter();
  const params = useParams();
  const [competition, setCompetition] = useState(null);
  const [leaderboards, setLeaderboards] = useState({});
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [sortBy, setSortBy] = useState('average'); // average or single
  const [searchQuery, setSearchQuery] = useState('');
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
        
        // Fetch registrations and leaderboards
        await Promise.all([
          fetchRegisteredUsers(),
          fetchLeaderboards(data.events)
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch competition:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRegisteredUsers() {
    try {
      const regsQuery = query(
        collection(db, 'registrations'),
        where('competitionId', '==', params.competitionId)
      );
      const regsSnapshot = await getDocs(regsQuery);
      
      const users = [];
      for (const regDoc of regsSnapshot.docs) {
        const regData = regDoc.data();
        // Fetch user details
        try {
          const userDoc = await getDoc(doc(db, 'users', regData.userId));
          const userData = userDoc.exists() ? userDoc.data() : {};
          users.push({
            id: regData.userId,
            ...regData,
            displayName: userData.displayName || regData.userName || 'Unknown',
            wcaStyleId: userData.wcaStyleId || regData.wcaStyleId || 'N/A',
            country: userData.country || 'Unknown',
            photoURL: userData.photoURL
          });
        } catch (e) {
          users.push({
            id: regData.userId,
            ...regData
          });
        }
      }
      setRegisteredUsers(users);
    } catch (error) {
      console.error('Failed to fetch registered users:', error);
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
          try {
            const userDoc = await getDoc(doc(db, 'users', resultData.userId));
            const userData = userDoc.exists() ? userDoc.data() : {};

            results.push({
              ...resultData,
              userName: userData.displayName || resultData.userName || 'Unknown',
              wcaStyleId: userData.wcaStyleId || resultData.wcaStyleId || 'N/A',
              country: userData.country || resultData.country || 'Unknown',
              photoURL: userData.photoURL,
              hasResults: true
            });
          } catch (e) {
            results.push({
              ...resultData,
              hasResults: true
            });
          }
        }

        leaderboardData[eventId] = results;
      }

      setLeaderboards(leaderboardData);
    } catch (error) {
      console.error('Failed to fetch leaderboards:', error);
    }
  }

  // Combine registered users with their results
  function getCombinedLeaderboard() {
    if (!selectedEvent) return [];
    
    const results = leaderboards[selectedEvent] || [];
    const resultsMap = new Map(results.map(r => [r.userId, r]));
    
    // Get users registered for this event
    const eventUsers = registeredUsers.filter(u => u.events?.includes(selectedEvent));
    
    // Create combined list
    const combined = eventUsers.map(user => {
      const result = resultsMap.get(user.id);
      if (result) {
        return result;
      }
      // User registered but no results yet
      return {
        userId: user.id,
        userName: user.displayName || user.userName,
        wcaStyleId: user.wcaStyleId,
        country: user.country,
        photoURL: user.photoURL,
        average: null,
        bestSingle: null,
        times: [],
        hasResults: false
      };
    });

    // Sort
    combined.sort((a, b) => {
      // Users with results come first
      if (a.hasResults && !b.hasResults) return -1;
      if (!a.hasResults && b.hasResults) return 1;
      
      // If neither has results, sort alphabetically
      if (!a.hasResults && !b.hasResults) {
        return (a.userName || '').localeCompare(b.userName || '');
      }
      
      // Both have results - sort by selected metric
      if (sortBy === 'single') {
        const aTime = a.bestSingle === Infinity || a.bestSingle === 'DNF' ? Infinity : (a.bestSingle || Infinity);
        const bTime = b.bestSingle === Infinity || b.bestSingle === 'DNF' ? Infinity : (b.bestSingle || Infinity);
        return aTime - bTime;
      } else {
        const aAvg = a.average === Infinity || a.average === 'DNF' || a.average === null ? Infinity : a.average;
        const bAvg = b.average === Infinity || b.average === 'DNF' || b.average === null ? Infinity : b.average;
        if (aAvg === bAvg) {
          // Tiebreaker: best single
          const aTime = a.bestSingle === Infinity ? Infinity : (a.bestSingle || Infinity);
          const bTime = b.bestSingle === Infinity ? Infinity : (b.bestSingle || Infinity);
          return aTime - bTime;
        }
        return aAvg - bAvg;
      }
    });

    // Filter by search
    if (searchQuery) {
      return combined.filter(entry => 
        entry.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.wcaStyleId?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return combined;
  }

  const formatTime = (ms) => {
    if (ms === Infinity || ms === 'DNF' || ms === null || ms === undefined) return '-';
    if (typeof ms !== 'number') return '-';
    const seconds = (ms / 1000).toFixed(2);
    return `${seconds}s`;
  };

  const getRankBadge = (index, hasResults) => {
    if (!hasResults) return <span className="text-gray-500">-</span>;
    if (index === 0) return <Medal className="h-6 w-6 text-yellow-500" />;
    if (index === 1) return <Medal className="h-6 w-6 text-gray-400" />;
    if (index === 2) return <Medal className="h-6 w-6 text-orange-600" />;
    return <span className="text-gray-400 font-bold text-lg">{index + 1}</span>;
  };

  const currentLeaderboard = getCombinedLeaderboard();

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
              <p className="text-gray-400">Leaderboard • {registeredUsers.length} Participants</p>
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

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40 bg-gray-800 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="average">By Average</SelectItem>
                  <SelectItem value="single">By Single</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700"
                />
              </div>
            </div>
          </div>
        </div>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-2xl">
              {getEventIcon(selectedEvent)} {getEventName(selectedEvent)} Results
              <span className="text-gray-400 font-normal text-lg ml-2">
                ({currentLeaderboard.length} participants)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentLeaderboard.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                No participants registered for this event yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700 hover:bg-gray-700/50">
                      <TableHead className="text-gray-300 w-20">Rank</TableHead>
                      <TableHead className="text-gray-300">Participant</TableHead>
                      <TableHead className="text-gray-300">MCUBES ID</TableHead>
                      <TableHead className="text-gray-300">Country</TableHead>
                      <TableHead className="text-gray-300 text-center">Solves</TableHead>
                      <TableHead className="text-gray-300 text-right font-bold">
                        {sortBy === 'average' ? 'Average' : 'Best Single'}
                      </TableHead>
                      <TableHead className="text-gray-300 text-right">
                        {sortBy === 'average' ? 'Best' : 'Avg'}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentLeaderboard.map((entry, index) => (
                      <TableRow key={entry.userId} className="border-gray-700 hover:bg-gray-700/50">
                        <TableCell>
                          <div className="flex items-center justify-center">
                            {getRankBadge(index, entry.hasResults)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {entry.photoURL && (
                              <img src={entry.photoURL} alt={entry.userName} className="h-8 w-8 rounded-full" />
                            )}
                            <span className="font-medium">{entry.userName || 'Unknown'}</span>
                            {!entry.hasResults && (
                              <Badge variant="outline" className="text-xs border-gray-600 text-gray-400">
                                No solves yet
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-400">{entry.wcaStyleId || 'N/A'}</TableCell>
                        <TableCell className="text-gray-400">{entry.country || 'Unknown'}</TableCell>
                        <TableCell className="text-center">
                          {entry.times && entry.times.length > 0 ? (
                            <div className="flex flex-wrap justify-center gap-1">
                              {entry.times.map((time, i) => (
                                <span key={i} className="text-xs bg-gray-700 px-2 py-0.5 rounded">
                                  {formatTime(time)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold text-xl">
                          {entry.hasResults ? (
                            sortBy === 'average' ? (
                              entry.average === Infinity || entry.average === 'DNF' ? (
                                <Badge variant="destructive">DNF</Badge>
                              ) : (
                                <span className="text-green-400">{formatTime(entry.average)}</span>
                              )
                            ) : (
                              entry.bestSingle === Infinity ? (
                                <Badge variant="destructive">DNF</Badge>
                              ) : (
                                <span className="text-blue-400">{formatTime(entry.bestSingle)}</span>
                              )
                            )
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-blue-400">
                          {entry.hasResults ? (
                            sortBy === 'average' ? formatTime(entry.bestSingle) : formatTime(entry.average)
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
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
