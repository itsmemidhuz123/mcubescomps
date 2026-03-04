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
import { Trophy, Search, Medal, User, ChevronDown, Swords } from 'lucide-react';
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
    const [battleRankings, setBattleRankings] = useState([]);
    const [battleLoading, setBattleLoading] = useState(true);

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

    useEffect(() => {
        fetchBattleRankings();
    }, [selectedEvent]);

    async function fetchBattleRankings() {
        setBattleLoading(true);
        try {
            const response = await fetch(`/api/leaderboard?event=${selectedEvent}&limit=50`);
            const data = await response.json();
            if (data.success) {
                setBattleRankings(data.leaderboard);
            }
        } catch (error) {
            console.error('Failed to fetch battle rankings:', error);
        } finally {
            setBattleLoading(false);
        }
    }

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
        if (index === 0) return <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center"><Medal className="w-5 h-5 text-yellow-600 dark:text-yellow-400" /></div>;
        if (index === 1) return <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><Medal className="w-5 h-5 text-slate-500 dark:text-slate-400" /></div>;
        if (index === 2) return <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center"><Medal className="w-5 h-5 text-orange-600 dark:text-orange-400" /></div>;
        return <span className="font-mono font-medium text-zinc-500 dark:text-zinc-400 w-8 text-center block">{index + 1}</span>;
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
        <div className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950/50">
            <div className="container mx-auto px-4 py-8 max-w-4xl">

                {/* Header Area */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-800">
                            <EventIcon eventId={selectedEvent} size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{getEventName(selectedEvent)}</h1>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm">Global Rankings • {mode === 'single' ? 'Single' : 'Average of 5'}</p>
                        </div>
                    </div>

                    <div className="flex items-center bg-white dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setMode('single')}
                            className={`text-xs font-medium px-4 h-8 rounded-md transition-all ${mode === 'single' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                        >
                            Single
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setMode('ao5')}
                            className={`text-xs font-medium px-4 h-8 rounded-md transition-all ${mode === 'ao5' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                        >
                            Average
                        </Button>
                    </div>
                </div>

                {/* Filters / Event Selection */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border shadow-sm p--zinc-8004 mb-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
                            {events.map(evt => (
                                <button
                                    key={evt}
                                    onClick={() => setSelectedEvent(evt)}
                                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${selectedEvent === evt
                                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-400'
                                            : 'bg-transparent border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                        }`}
                                >
                                    {evt.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <Input
                                placeholder="Search player..."
                                className="pl-9 h-10 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 focus:bg-white dark:focus:bg-zinc-900 transition-colors"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Rankings Table */}
                <Card className="border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden bg-white dark:bg-zinc-900 rounded-xl">
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-12 text-center">
                                <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading rankings...</p>
                            </div>
                        ) : filteredRankings.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Trophy className="w-6 h-6 text-zinc-300 dark:text-zinc-600" />
                                </div>
                                <p className="text-zinc-900 dark:text-white font-medium">No results found</p>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">Be the first to set a record!</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="bg-zinc-50/50 dark:bg-zinc-800/50">
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
                                   ${isCurrentUser ? 'bg-blue-50/50 dark:bg-blue-900/20 hover:bg-blue-50 dark:hover:bg-blue-900/30' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}
                                `}
                                            >
                                                <TableCell className="text-center font-medium">
                                                    <div className="flex justify-center">
                                                        {getRankIcon(globalIndex)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="w-8 h-8 border border-zinc-100 dark:border-zinc-800">
                                                            <AvatarFallback className={isCurrentUser ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}>
                                                                {rank.userName?.charAt(0) || 'U'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <div className={`font-semibold text-sm ${isCurrentUser ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-900 dark:text-white'}`}>
                                                                <Link href={`/user/${rank.userId}`} className="hover:underline hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                                                    {rank.userName}
                                                                </Link>
                                                                {isCurrentUser && ' (You)'}
                                                            </div>
                                                            <div className="text-xs text-zinc-500 dark:text-zinc-400 md:hidden">{rank.competitionName}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="font-mono font-bold text-zinc-900 dark:text-white">
                                                        {formatTime(mode === 'single' ? rank.bestSingle : rank.average)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell text-right text-sm text-zinc-500 dark:text-zinc-400">
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
                        <div className="flex items-center justify-between px-4 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-800/30">
                            <div className="text-sm text-zinc-500 dark:text-zinc-400">
                                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredRankings.length)} of {filteredRankings.length}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="h-8 text-xs border-zinc-200 dark:border-zinc-700"
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
                                                className={`h-8 w-8 p-0 text-xs ${currentPage === pNum ? 'bg-blue-600' : 'text-zinc-600 dark:text-zinc-400'}`}
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
                                    className="h-8 text-xs border-zinc-200 dark:border-zinc-700"
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Battle ELO Rankings Section */}
                <div className="mt-8">
                    <div className="flex items-center gap-2 mb-4">
                        <Swords className="w-5 h-5 text-yellow-500" />
                        <h2 className="text-xl font-bold">Battle ELO Rankings</h2>
                    </div>
                    <Card className="border border-zinc-200 dark:border-zinc-800">
                        {battleLoading ? (
                            <div className="p-8 text-center">
                                <div className="animate-spin w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full mx-auto"></div>
                            </div>
                        ) : battleRankings.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500">
                                <p>No battle rankings yet</p>
                                <p className="text-sm">Play battles to earn ELO!</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Rank</TableHead>
                                        <TableHead>Player</TableHead>
                                        <TableHead className="text-right">ELO Rating</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {battleRankings.slice(0, 10).map((player) => (
                                        <TableRow key={player.uid}>
                                            <TableCell className="font-mono">{player.rank}</TableCell>
                                            <TableCell>{player.displayName}</TableCell>
                                            <TableCell className="text-right font-mono font-bold text-yellow-600 dark:text-yellow-400">
                                                {player.rating}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </Card>
                </div>

            </div>
        </div>
    );
}

export default RankingsPage;