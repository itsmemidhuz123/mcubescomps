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
    if (!hasResults) return <Badge variant="outline" className="text-xs bg-gray-50 text-gray-400 border-gray-200">Registered</Badge>;
    if (index === 0) return <Medal className="h-6 w-6 text-yellow-500" />;
    if (index === 1) return <Medal className="h-6 w-6 text-gray-400" />;
    if (index === 2) return <Medal className="h-6 w-6 text-orange-600" />;
    return <span className="text-gray-500 font-bold text-lg">{index + 1}</span>;
  };

  const currentLeaderboard = getCombinedLeaderboard();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
           <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
           <div className="text-gray-500 text-sm">Loading leaderboard...</div>
        </div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-900 text-xl font-medium">Competition not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => router.push(`/competition/${params.competitionId}`)}
          className="mb-6 text-gray-500 hover:text-gray-900 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Competition
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100">
               <Trophy className="h-8 w-8 text-yellow-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{competition.name}</h1>
              <p className="text-gray-500">Leaderboard • {registeredUsers.length} Participants</p>
            </div>
          </div>

          {/* Event Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {competition.events?.map(eventId => (
              <Button
                key={eventId}
                variant={selectedEvent === eventId ? 'default' : 'outline'}
                onClick={() => setSelectedEvent(eventId)}
                className={`
                  ${selectedEvent === eventId 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}
                `}
              >
                {getEventIcon(eventId)} <span className="ml-2">{getEventName(eventId)}</span>
              </Button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="bg-white rounded-md border border-gray-200 p-1 shadow-sm">
                 <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px] border-none shadow-none h-8">
                     <Filter className="h-3.5 w-3.5 mr-2 text-gray-400" />
                     <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="average">Sort by Average</SelectItem>
                     <SelectItem value="single">Sort by Best Single</SelectItem>
                  </SelectContent>
                 </Select>
              </div>
            </div>
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search competitor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        <Card className="bg-white border-gray-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
            <CardTitle className="text-gray-900 text-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                 {getEventIcon(selectedEvent)} 
                 <span>{getEventName(selectedEvent)} Results</span>
              </div>
              <Badge variant="secondary" className="font-normal text-gray-500 bg-white border border-gray-200">
                {currentLeaderboard.length} entries
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {currentLeaderboard.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Trophy className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p>No participants registered for this event yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-100 hover:bg-gray-50/50 bg-gray-50/30">
                      <TableHead className="text-gray-500 w-20 text-center">Rank</TableHead>
                      <TableHead className="text-gray-500">Competitor</TableHead>
                      <TableHead className="text-gray-500 hidden md:table-cell">WCA ID</TableHead>
                      <TableHead className="text-gray-500 hidden sm:table-cell">Country</TableHead>
                      <TableHead className="text-gray-500 text-center hidden lg:table-cell">Solves</TableHead>
                      <TableHead className="text-gray-500 text-right font-bold w-32">
                        {sortBy === 'average' ? 'Average' : 'Best Single'}
                      </TableHead>
                      <TableHead className="text-gray-500 text-right w-32 hidden sm:table-cell">
                        {sortBy === 'average' ? 'Best' : 'Avg'}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentLeaderboard.map((entry, index) => (
                      <TableRow 
                        key={entry.userId} 
                        className="border-gray-100 hover:bg-gray-50/80 transition-colors"
                      >
                        <TableCell>
                          <div className="flex items-center justify-center">
                            {getRankBadge(index, entry.hasResults)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-gray-100">
                               <AvatarImage src={entry.photoURL} />
                               <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
                                  {entry.userName?.charAt(0) || 'U'}
                               </AvatarFallback>
                            </Avatar>
                            <div>
                               <div className="font-medium text-gray-900">{entry.userName || 'Unknown'}</div>
                               {!entry.hasResults && (
                                 <p className="text-[10px] text-gray-400 sm:hidden">No solves</p>
                               )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-500 hidden md:table-cell font-mono text-xs">{entry.wcaStyleId || '-'}</TableCell>
                        <TableCell className="text-gray-500 hidden sm:table-cell">{entry.country || '-'}</TableCell>
                        <TableCell className="text-center hidden lg:table-cell">
                          {entry.times && entry.times.length > 0 ? (
                            <div className="flex flex-wrap justify-center gap-1">
                              {entry.times.map((time, i) => (
                                <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                                  {formatTime(time)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg">
                          {entry.hasResults ? (
                            sortBy === 'average' ? (
                              entry.average === Infinity || entry.average === 'DNF' ? (
                                <Badge variant="destructive" className="text-[10px] h-5">DNF</Badge>
                              ) : (
                                <span className="text-gray-900">{formatTime(entry.average)}</span>
                              )
                            ) : (
                              entry.bestSingle === Infinity ? (
                                <Badge variant="destructive" className="text-[10px] h-5">DNF</Badge>
                              ) : (
                                <span className="text-blue-600">{formatTime(entry.bestSingle)}</span>
                              )
                            )
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-gray-500 text-sm hidden sm:table-cell">
                          {entry.hasResults ? (
                            sortBy === 'average' ? formatTime(entry.bestSingle) : formatTime(entry.average)
                          ) : (
                            <span className="text-gray-300">-</span>
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