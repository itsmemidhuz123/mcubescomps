'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Search, Medal, User, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { getEventName } from '@/lib/wcaEvents';
import EventIcon from '@/lib/EventIcon';

// Rankings Page - Global UI Consistency Update
// Matches "Bronze League" style: Clean table, sticky header, medal icons, user highlight.
// Logic preserved 100%.

function RankingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedEvent, setSelectedEvent] = useState('333');
  const [mode, setMode] = useState('single');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  const [tab, setTab] = useState('rankings');
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Stats for the "My Progress" style header cards (preserved from logic)
  const [stats, setStats] = useState({ competitors: 0, solves: 0 });

  const events = ['333', '222', '444', '555', '333oh', 'pyram', 'skewb', 'clock'];

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedEvent, mode, searchQuery]);

  useEffect(() => {
    fetchStats();
    fetchRankings();
  }, [selectedEvent, mode]);

  async function fetchStats() {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      setStats(prev => ({ ...prev, competitors: usersSnapshot.size }));
      // Solves count would typically require a count query or aggregation, skipping for now to save reads/logic complexity
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }

  async function fetchRankings() {
    setLoading(true);
    try {
      const resultsRef = collection(db, 'results');
      const snapshot = await getDocs(resultsRef);
      
      const userBestResults = new Map();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.eventId === selectedEvent) {
          const userId = data.userId;
          const currentResult = { id: doc.id, ...data };
          
          const currentTime = mode === 'single' 
            ? (currentResult.bestSingle || Infinity) 
            : (currentResult.average || Infinity);
          
          const existingResult = userBestResults.get(userId);
          
          if (!existingResult) {
            userBestResults.set(userId, currentResult);
          } else {
            const existingTime = mode === 'single'
              ? (existingResult.bestSingle || Infinity)
              : (existingResult.average || Infinity);
            
            if (currentTime < existingTime) {
              userBestResults.set(userId, currentResult);
            }
          }
        }
      });

      const rankingsData = Array.from(userBestResults.values());
      
      rankingsData.sort((a, b) => {
        const timeA = mode === 'single' ? (a.bestSingle || Infinity) : (a.average || Infinity);
        const timeB = mode === 'single' ? (b.bestSingle || Infinity) : (b.average || Infinity);
        return timeA - timeB;
      });

      setRankings(rankingsData);
    } catch (error) {
      console.error('Failed to fetch rankings:', error);
      setRankings([]);
    } finally {
      setLoading(false);
    }
  }

  const formatTime = (ms) => {
    if (!ms || ms === Infinity) return '-';
    return (ms / 1000).toFixed(2);
  };

  const getRankIcon = (index) => {
    if (index === 0) return <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center"><Medal className="w-5 h-5 text-yellow-600" /></div>;
    if (index === 1) return <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><Medal className="w-5 h-5 text-slate-500" /></div>;
    if (index === 2) return <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center"><Medal className="w-5 h-5 text-orange-600" /></div>;
    return <span className="font-mono font-medium text-gray-500 w-8 text-center block">{index + 1}</span>;
  };

  const filteredRankings = rankings.filter(r => {
    if (!searchQuery) return true;
    return r.userName?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalPages = Math.ceil(filteredRankings.length / itemsPerPage);
  const paginatedRankings = filteredRankings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        
        {/* Header Area */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
           <div className="flex items-center gap-4">
               <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                  <EventIcon eventId={selectedEvent} size={28} />
               </div>
              <div>
                 <h1 className="text-2xl font-bold text-gray-900">{getEventName(selectedEvent)}</h1>
                 <p className="text-gray-500 text-sm">Global Rankings • {mode === 'single' ? 'Single' : 'Average of 5'}</p>
              </div>
           </div>
           
           <div className="flex items-center bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setMode('single')}
                className={`text-xs font-medium px-4 h-8 rounded-md transition-all ${mode === 'single' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Single
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setMode('ao5')}
                className={`text-xs font-medium px-4 h-8 rounded-md transition-all ${mode === 'ao5' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Average
              </Button>
           </div>
        </div>

        {/* Filters / Event Selection */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
           <div className="flex flex-col gap-4">
              <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
                 {events.map(evt => (
                    <button
                       key={evt}
                       onClick={() => setSelectedEvent(evt)}
                       className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                          selectedEvent === evt 
                             ? 'bg-blue-50 border-blue-100 text-blue-700' 
                             : 'bg-transparent border-transparent text-gray-600 hover:bg-gray-50'
                       }`}
                    >
                       {evt.toUpperCase()}
                    </button>
                 ))}
              </div>
              
              <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <Input 
                    placeholder="Search player..." 
                    className="pl-9 h-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                 />
              </div>
           </div>
        </div>

        {/* Rankings Table */}
        <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white rounded-xl">
           <div className="overflow-x-auto">
              {loading ? (
                 <div className="p-12 text-center">
                    <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-sm text-gray-500">Loading rankings...</p>
                 </div>
              ) : filteredRankings.length === 0 ? (
                 <div className="p-12 text-center">
                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                       <Trophy className="w-6 h-6 text-gray-300" />
                    </div>
                    <p className="text-gray-900 font-medium">No results found</p>
                    <p className="text-sm text-gray-500">Be the first to set a record!</p>
                 </div>
              ) : (
                 <Table>
                    <TableHeader className="bg-gray-50/50">
                       <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[80px] text-center">Rank</TableHead>
                          <TableHead>Competitor</TableHead>
                          <TableHead className="text-right">Result</TableHead>
                          <TableHead className="hidden md:table-cell text-right">Competition</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {paginatedRankings.map((rank, index) => {
                          const globalIndex = (currentPage - 1) * itemsPerPage + index;
                          const isCurrentUser = user && rank.userId === user.uid;
                          return (
                             <TableRow 
                                key={rank.id || index} 
                                className={`
                                   group transition-colors
                                   ${isCurrentUser ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-gray-50'}
                                `}
                             >
                                <TableCell className="text-center font-medium">
                                   <div className="flex justify-center">
                                      {getRankIcon(globalIndex)}
                                   </div>
                                </TableCell>
                                <TableCell>
                                   <div className="flex items-center gap-3">
                                      <Avatar className="w-8 h-8 border border-gray-100">
                                         <AvatarFallback className={isCurrentUser ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}>
                                            {rank.userName?.charAt(0) || 'U'}
                                         </AvatarFallback>
                                      </Avatar>
                                      <div>
                                         <div className={`font-semibold text-sm ${isCurrentUser ? 'text-blue-700' : 'text-gray-900'}`}>
                                            <Link href={`/user/${rank.userId}`} className="hover:underline hover:text-blue-600 transition-colors">
                                              {rank.userName}
                                            </Link>
                                            {isCurrentUser && ' (You)'}
                                         </div>
                                         <div className="text-xs text-gray-500 md:hidden">{rank.competitionName}</div>
                                      </div>
                                   </div>
                                </TableCell>
                                <TableCell className="text-right">
                                   <div className="font-mono font-bold text-gray-900">
                                      {formatTime(mode === 'single' ? rank.bestSingle : rank.average)}
                                   </div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-right text-sm text-gray-500">
                                   {rank.competitionName}
                                </TableCell>
                             </TableRow>
                          );
                       })}
                    </TableBody>
                 </Table>
              )}
           </div>
           
           {/* Pagination Controls */}
           {totalPages > 1 && (
             <div className="flex items-center justify-between px-4 py-4 border-t border-gray-100 bg-gray-50/30">
               <div className="text-sm text-gray-500">
                 Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredRankings.length)} of {filteredRankings.length}
               </div>
               <div className="flex gap-2">
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                   disabled={currentPage === 1}
                   className="h-8 text-xs"
                 >
                   Previous
                 </Button>
                 <div className="flex items-center gap-1">
                   {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                     // Simple pagination logic for display
                     let pNum = i + 1;
                     if (totalPages > 5 && currentPage > 3) {
                       pNum = currentPage - 3 + i;
                       if (pNum > totalPages) pNum = i + (totalPages - 4);
                     }
                     
                     return (
                       <Button
                         key={pNum}
                         variant={currentPage === pNum ? "default" : "ghost"}
                         size="sm"
                         onClick={() => setCurrentPage(pNum)}
                         className={`h-8 w-8 p-0 text-xs ${currentPage === pNum ? 'bg-blue-600' : 'text-gray-600'}`}
                       >
                         {pNum}
                       </Button>
                     );
                   })}
                 </div>
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                   disabled={currentPage === totalPages}
                   className="h-8 text-xs"
                 >
                   Next
                 </Button>
               </div>
             </div>
           )}
        </Card>

      </div>
    </div>
  );
}

export default RankingsPage;