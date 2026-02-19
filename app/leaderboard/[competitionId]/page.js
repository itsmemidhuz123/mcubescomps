'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    ArrowLeft, Trophy, Medal, Search, Filter, Clock, Timer, AlertTriangle,
    Layers, CheckCircle, XCircle, Lock, Eye, Download, ChevronDown,
    User, Flag, Award, FileText, Check
} from 'lucide-react';
import { getEventName } from '@/lib/wcaEvents';
import EventIcon from '@/lib/EventIcon';
import Link from 'next/link';
import { CompetitionMode, TournamentStatus } from '@/lib/tournament';

function formatTime(ms) {
    if (ms === Infinity || ms === null || ms === undefined || ms === 'DNF') return 'DNF';
    if (typeof ms !== 'number') return 'DNF';
    const seconds = (ms / 1000).toFixed(2);
    return `${seconds}s`;
}

function formatTimeDetailed(ms) {
    if (ms === Infinity || ms === null || ms === undefined || ms === 'DNF') return 'DNF';
    if (typeof ms !== 'number') return 'DNF';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);
    if (minutes > 0) {
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}.${centiseconds.toString().padStart(2, '0')}s`;
}

export default function LeaderboardPage() {
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const params = useParams();

    const [competition, setCompetition] = useState(null);
    const [leaderboards, setLeaderboards] = useState({});
    const [roundResults, setRoundResults] = useState({});
    const [registeredUsers, setRegisteredUsers] = useState([]);
    const [tournamentParticipants, setTournamentParticipants] = useState([]);

    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedRound, setSelectedRound] = useState(null);
    const [selectedStatus, setSelectedStatus] = useState('ongoing');
    const [sortBy, setSortBy] = useState('average');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('ao5');
    const [loading, setLoading] = useState(true);

    const [selectedUserResult, setSelectedUserResult] = useState(null);
    const [showUserModal, setShowUserModal] = useState(false);
    const [userSolves, setUserSolves] = useState([]);

    useEffect(() => {
        if (params.competitionId) {
            fetchCompetition();
        }
    }, [params.competitionId]);

    useEffect(() => {
        if (competition) {
            if (competition.mode === CompetitionMode.TOURNAMENT) {
                setSelectedRound(competition.currentRound || 1);
            }
            const events = competition.events || [];
            setSelectedEvent(events.length > 0 ? events[0] : null);
        }
    }, [competition]);

    async function fetchCompetition() {
        try {
            console.log('Fetching competition:', params.competitionId);
            const compDoc = await getDoc(doc(db, 'competitions', params.competitionId));
            if (!compDoc.exists()) {
                console.log('Competition not found');
                setLoading(false);
                return;
            }

            const data = compDoc.data();
            console.log('Competition data:', data);
            setCompetition({ id: compDoc.id, ...data });

            const isTournament = data.mode === 'tournament' || data.mode === CompetitionMode.TOURNAMENT;

            if (isTournament) {
                setSelectedRound(data.currentRound || 1);
                await Promise.all([
                    fetchTournamentParticipants(),
                    fetchRoundResults(),
                    fetchRegisteredUsers()
                ]);
            } else {
                await Promise.all([
                    fetchRegisteredUsers(),
                    fetchLeaderboards(data.events || [])
                ]);
            }
        } catch (error) {
            console.error('Failed to fetch competition:', error);
            alert('Error loading competition: ' + error.message);
        } finally {
            setLoading(false);
        }
    }

    async function fetchRegisteredUsers() {
        try {
            const regsQuery = query(collection(db, 'registrations'), where('competitionId', '==', params.competitionId));
            const regsSnapshot = await getDocs(regsQuery);
            const users = [];
            for (const regDoc of regsSnapshot.docs) {
                const regData = regDoc.data();
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
                    users.push({ id: regData.userId, ...regData });
                }
            }
            setRegisteredUsers(users);
        } catch (error) {
            console.error('Failed to fetch registered users:', error);
        }
    }

    async function fetchTournamentParticipants() {
        try {
            const participantsQuery = query(collection(db, 'tournamentParticipants'), where('competitionId', '==', params.competitionId));
            const snapshot = await getDocs(participantsQuery);
            const participantsData = [];
            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                try {
                    const userDoc = await getDoc(doc(db, 'users', data.userId));
                    const userData = userDoc.exists() ? userDoc.data() : {};
                    participantsData.push({
                        id: docSnap.id,
                        ...data,
                        displayName: userData.displayName || data.userName || 'Unknown',
                        photoURL: userData.photoURL,
                        country: userData.country || 'Unknown'
                    });
                } catch (e) {
                    participantsData.push({ id: docSnap.id, ...data });
                }
            }
            setTournamentParticipants(participantsData);
        } catch (error) {
            console.error('Failed to fetch tournament participants:', error);
        }
    }

    async function fetchRoundResults() {
        try {
            const resultsQuery = query(collection(db, 'roundResults'), where('competitionId', '==', params.competitionId));
            const snapshot = await getDocs(resultsQuery);
            const resultsByRound = {};
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                const roundNum = data.roundNumber || 1;
                if (!resultsByRound[roundNum]) resultsByRound[roundNum] = [];
                resultsByRound[roundNum].push({ id: docSnap.id, ...data });
            });
            setRoundResults(resultsByRound);
        } catch (error) {
            console.error('Failed to fetch round results:', error);
        }
    }

    async function fetchLeaderboards(events) {
        try {
            const leaderboardData = {};
            for (const eventId of events || []) {
                const resultsQuery = query(collection(db, 'results'), where('competitionId', '==', params.competitionId));
                const resultsSnapshot = await getDocs(resultsQuery);
                const results = [];
                for (const resultDoc of resultsSnapshot.docs) {
                    const resultData = resultDoc.data();
                    try {
                        const userDoc = await getDoc(doc(db, 'users', resultData.userId));
                        const userData = userDoc.exists() ? userDoc.data() : {};
                        results.push({
                            ...resultData,
                            userName: userData.displayName || resultData.userName || 'Unknown',
                            wcaStyleId: userData.wcaStyleId || resultData.wcaStyleId || 'N/A',
                            country: userData.country || resultData.country || 'Unknown',
                            photoURL: userData.photoURL,
                            hasResults: true,
                            flagged: resultData.flagged || false
                        });
                    } catch (e) {
                        results.push({ ...resultData, hasResults: true, flagged: resultData.flagged || false });
                    }
                }
                leaderboardData[eventId] = results;
            }
            setLeaderboards(leaderboardData);
        } catch (error) {
            console.error('Failed to fetch leaderboards:', error);
        }
    }

    async function openUserDetails(result) {
        setSelectedUserResult(result);
        try {
            const solvesQuery = query(
                collection(db, 'solves'),
                where('competitionId', '==', params.competitionId),
                where('userId', '==', result.userId),
                where('eventId', '==', selectedEvent),
                orderBy('attemptNumber', 'asc')
            );
            const snapshot = await getDocs(solvesQuery);
            setUserSolves(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error('Error fetching solves:', error);
        }
        setShowUserModal(true);
    }

    function getCompetitionStatus() {
        if (!competition) return 'unknown';
        const now = new Date();
        const start = competition.competitionStartDate ? new Date(competition.competitionStartDate) : new Date(competition.startDate);
        const end = competition.competitionEndDate ? new Date(competition.competitionEndDate) : new Date(competition.endDate);

        if (now < start) return 'upcoming';
        if (now > end) return 'past';
        return 'ongoing';
    }

    function getCombinedLeaderboard() {
        if (!selectedEvent || !competition) return [];
        const compStatus = getCompetitionStatus();

        if (compStatus === 'upcoming') {
            const eventUsers = registeredUsers.filter(u => u.events?.includes(selectedEvent));
            return eventUsers.map(user => ({
                userId: user.id,
                userName: user.displayName || user.userName,
                wcaStyleId: user.wcaStyleId,
                country: user.country,
                photoURL: user.photoURL,
                hasResults: false,
                status: 'registered'
            }));
        }

        if (competition.mode === CompetitionMode.TOURNAMENT) {
            const roundNum = selectedRound || competition.currentRound || 1;
            const results = roundResults[roundNum] || [];
            const resultsForEvent = results.filter(r => r.eventId === selectedEvent);
            const participantMap = new Map(tournamentParticipants.map(p => [p.userId, p]));
            const resultsMap = new Map(resultsForEvent.map(r => [r.userId, r]));
            const eventUsers = registeredUsers.filter(u => u.events?.includes(selectedEvent));

            const combined = eventUsers.map(user => {
                const result = resultsMap.get(user.id);
                const participant = participantMap.get(user.id);

                if (result) {
                    const useTime = viewMode === 'single' ? result.bestSingle : result.average;
                    return {
                        ...result,
                        userName: result.userName || user.displayName || user.userName,
                        wcaStyleId: result.wcaStyleId || user.wcaStyleId,
                        country: result.country || user.country,
                        photoURL: user.photoURL,
                        hasResults: true,
                        displayTime: useTime,
                        participantStatus: participant?.eliminated ? 'eliminated' : participant?.qualified ? 'qualified' : 'active',
                        currentRound: participant?.currentRound || 1,
                        qualifiedForNextRound: result.qualifiedForNextRound || participant?.qualified || false,
                        disqualified: result.disqualified || false,
                        verificationStatus: result.verificationStatus || 'pending',
                        flagLevel: result.flagLevel
                    };
                }

                return {
                    userId: user.id,
                    userName: user.displayName || user.userName,
                    wcaStyleId: user.wcaStyleId,
                    country: user.country,
                    photoURL: user.photoURL,
                    average: null,
                    bestSingle: null,
                    times: [],
                    hasResults: false,
                    flagged: false,
                    participantStatus: participant?.eliminated ? 'eliminated' : participant?.qualified ? 'qualified' : 'active',
                    currentRound: participant?.currentRound || 1
                };
            });

            combined.sort((a, b) => {
                if (!a.hasResults && !b.hasResults) return (a.userName || '').localeCompare(b.userName || '');
                if (!a.hasResults) return 1;
                if (!b.hasResults) return -1;

                const aTime = a.displayTime === Infinity || a.displayTime === 'DNF' || a.displayTime === null ? Infinity : a.displayTime;
                const bTime = b.displayTime === Infinity || b.displayTime === 'DNF' || b.displayTime === null ? Infinity : b.displayTime;
                return aTime - bTime;
            });

            return combined;
        }

        const results = leaderboards[selectedEvent] || [];
        const resultsMap = new Map(results.map(r => [r.userId, r]));
        const eventUsers = registeredUsers.filter(u => u.events?.includes(selectedEvent));

        const combined = eventUsers.map(user => {
            const result = resultsMap.get(user.id);
            if (result) {
                const useTime = viewMode === 'single' ? result.bestSingle : result.average;
                return { ...result, displayTime: useTime };
            }
            return {
                userId: user.id,
                userName: user.displayName || user.userName,
                wcaStyleId: user.wcaStyleId,
                country: user.country,
                photoURL: user.photoURL,
                average: null,
                bestSingle: null,
                times: [],
                hasResults: false,
                flagged: false
            };
        });

        combined.sort((a, b) => {
            if (!a.hasResults && !b.hasResults) return (a.userName || '').localeCompare(b.userName || '');
            if (!a.hasResults) return 1;
            if (!b.hasResults) return -1;
            const aTime = a.displayTime === Infinity || a.displayTime === 'DNF' || a.displayTime === null ? Infinity : a.displayTime;
            const bTime = b.displayTime === Infinity || b.displayTime === 'DNF' || b.displayTime === null ? Infinity : b.displayTime;
            return aTime - bTime;
        });

        return combined;
    }

    function getRankBadge(index, result) {
        if (!result.hasResults) return <Badge variant="outline" className="text-xs bg-gray-50 text-gray-400">Registered</Badge>;
        if (result.disqualified) return <Badge className="text-xs bg-red-100 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />DQ</Badge>;
        if (result.qualifiedForNextRound) return <Badge className="text-xs bg-green-100 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Qualified</Badge>;
        if (index === 0) return <Medal className="h-6 w-6 text-yellow-500" />;
        if (index === 1) return <Medal className="h-6 w-6 text-gray-400" />;
        if (index === 2) return <Medal className="h-6 w-6 text-orange-600" />;
        return <span className="text-gray-500 font-bold text-lg">{index + 1}</span>;
    }

    function getCurrentRoundData() {
        if (!competition || !competition.rounds) return null;
        return competition.rounds.find(r => r.roundNumber === selectedRound);
    }

    function getQualificationCount() {
        const roundData = getCurrentRoundData();
        if (!roundData) return 0;
        const results = getCombinedLeaderboard().filter(r => r.hasResults && !r.disqualified);
        const total = results.length;
        if (roundData.qualifyType === 'percentage') {
            return Math.ceil(total * (roundData.qualifyValue / 100));
        }
        return Math.min(roundData.qualifyValue, total);
    }

    const currentLeaderboard = getCombinedLeaderboard();
    const filteredLeaderboard = currentLeaderboard.filter(entry => {
        if (!searchQuery) return true;
        const name = (entry.userName || '').toLowerCase();
        const wcaId = (entry.wcaStyleId || '').toLowerCase();
        return name.includes(searchQuery.toLowerCase()) || wcaId.includes(searchQuery.toLowerCase());
    });

    const compStatus = getCompetitionStatus();
    const isRoundLocked = competition?.roundLocked?.[selectedRound];

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                    <div className="text-gray-500 text-sm">Loading leaderboard...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900">
            <div className="container mx-auto px-4 py-8 max-w-6xl">
                <Button variant="ghost" onClick={() => router.push(`/competition/${params.competitionId}`)} className="mb-6 text-gray-500 hover:text-gray-900 -ml-2">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Competition
                </Button>

                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                            <Trophy className="h-8 w-8 text-yellow-500" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">{competition?.name}</h1>
                            <p className="text-gray-500 flex items-center gap-2">
                                Leaderboard • {registeredUsers.length} Participants
                                {competition?.mode === CompetitionMode.TOURNAMENT && (
                                    <Badge className="bg-indigo-100 text-indigo-700">
                                        <Layers className="h-3 w-3 mr-1" />
                                        Tournament
                                    </Badge>
                                )}
                                {isRoundLocked && (
                                    <Badge className="bg-red-100 text-red-700">
                                        <Lock className="h-3 w-3 mr-1" />
                                        Official - Locked
                                    </Badge>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 mb-4">
                        <Button variant={selectedStatus === 'upcoming' ? 'default' : 'outline'} size="sm" onClick={() => setSelectedStatus('upcoming')}>
                            Upcoming
                        </Button>
                        <Button variant={selectedStatus === 'ongoing' ? 'default' : 'outline'} size="sm" onClick={() => setSelectedStatus('ongoing')}>
                            Ongoing
                        </Button>
                        {competition?.mode === CompetitionMode.TOURNAMENT && (
                            <Button variant={selectedStatus === 'multi' ? 'default' : 'outline'} size="sm" onClick={() => setSelectedStatus('multi')}>
                                Multi-Round
                            </Button>
                        )}
                        <Button variant={selectedStatus === 'past' ? 'default' : 'outline'} size="sm" onClick={() => setSelectedStatus('past')}>
                            Past
                        </Button>
                    </div>

                    {competition?.mode === CompetitionMode.TOURNAMENT && (
                        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-indigo-900 flex items-center gap-2">
                                    <Layers className="h-4 w-4" />
                                    Round Selection
                                </h3>
                                <Badge className="bg-indigo-600 text-white">
                                    Current: Round {competition.currentRound || 1}
                                </Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {competition.rounds?.map(round => (
                                    <Button key={round.roundNumber} variant={selectedRound === round.roundNumber ? 'default' : 'outline'} size="sm" onClick={() => setSelectedRound(round.roundNumber)}
                                        className={selectedRound === round.roundNumber ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'}>
                                        {round.name || `Round ${round.roundNumber}`}
                                        {round.isFinal && <span className="ml-1">(Final)</span>}
                                    </Button>
                                ))}
                            </div>
                            {selectedRound && getCurrentRoundData() && (
                                <div className="mt-3 text-sm text-indigo-700">
                                    Qualify: Top {getCurrentRoundData().qualifyType === 'percentage' ? `${getCurrentRoundData().qualifyValue}%` : getCurrentRoundData().qualifyValue} participants
                                    {currentLeaderboard.filter(r => r.hasResults && !r.disqualified).length > 0 && (
                                        <span className="ml-2">({getQualificationCount()} spots)</span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 mb-6">
                        {(competition?.events || []).map(eventId => (
                            <Button key={eventId} variant={selectedEvent === eventId ? 'default' : 'outline'} onClick={() => setSelectedEvent(eventId)}
                                className={selectedEvent === eventId ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}>
                                <EventIcon eventId={eventId} size={20} /> <span className="ml-2">{getEventName(eventId)}</span>
                            </Button>
                        ))}
                    </div>

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
                            <div className="bg-white rounded-md border border-gray-200 p-1 shadow-sm">
                                <Select value={viewMode} onValueChange={setViewMode}>
                                    <SelectTrigger className="w-[120px] border-none shadow-none h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ao5">Ao5</SelectItem>
                                        <SelectItem value="single">Single</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex-1 max-w-md">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input placeholder="Search competitor..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-white border-gray-200 shadow-sm" />
                            </div>
                        </div>
                    </div>
                </div>

                <Card className="bg-white border-gray-200 shadow-sm overflow-hidden">
                    <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                        <CardTitle className="text-gray-900 text-xl flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <EventIcon eventId={selectedEvent} size={24} />
                                <span>{getEventName(selectedEvent)} Results</span>
                            </div>
                            <Badge variant="secondary" className="font-normal text-gray-500 bg-white border border-gray-200">
                                {filteredLeaderboard.length} entries
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {filteredLeaderboard.length === 0 ? (
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
                                            <TableHead className="text-gray-500 w-16 text-center">Avatar</TableHead>
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
                                            <TableHead className="text-gray-500 w-20">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredLeaderboard.map((entry, index) => {
                                            const isCurrentUser = user?.uid === entry.userId;
                                            const isQualified = entry.qualifiedForNextRound;
                                            const qualificationCutoff = getQualificationCount();
                                            const isOnCutoff = index + 1 > qualificationCutoff && isQualified === false && entry.hasResults && !entry.disqualified;

                                            return (
                                                <TableRow key={entry.userId} className={`border-gray-100 hover:bg-gray-50/80 transition-colors ${isCurrentUser ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''} ${isOnCutoff ? 'bg-red-50' : ''} ${isQualified && index < qualificationCutoff ? 'bg-green-50' : ''}`}>
                                                    <TableCell>
                                                        <div className="flex items-center justify-center">
                                                            {getRankBadge(index, entry)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center justify-center">
                                                            <Avatar className="h-9 w-9 border border-gray-100">
                                                                <AvatarImage src={entry.photoURL} />
                                                                <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">{entry.userName?.charAt(0) || 'U'}</AvatarFallback>
                                                            </Avatar>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <Link href={`/user/${entry.userId}`} className="font-medium text-gray-900 hover:text-blue-600 hover:underline transition-colors">
                                                                {entry.userName || 'Unknown'}
                                                            </Link>
                                                            {isCurrentUser && <Badge className="bg-blue-100 text-blue-700 text-xs">You</Badge>}
                                                            {entry.flagged && (
                                                                <div className="group relative">
                                                                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-48 bg-gray-900 text-white text-xs rounded p-2 z-10 text-center">
                                                                        Flagged for review
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {!entry.hasResults && <p className="text-[10px] text-gray-400 sm:hidden">No solves</p>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-gray-500 hidden md:table-cell font-mono text-xs">{entry.wcaStyleId || '-'}</TableCell>
                                                    <TableCell className="text-gray-500 hidden sm:table-cell">{entry.country || '-'}</TableCell>
                                                    <TableCell className="text-center hidden lg:table-cell">
                                                        {entry.times && entry.times.length > 0 ? (
                                                            <div className="flex flex-wrap justify-center gap-1">
                                                                {entry.times.map((time, i) => (
                                                                    <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">{formatTime(time)}</span>
                                                                ))}
                                                            </div>
                                                        ) : <span className="text-gray-300">-</span>}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-lg">
                                                        {entry.hasResults ? (
                                                            sortBy === 'average' ? (
                                                                entry.average === Infinity || entry.average === 'DNF' ? (
                                                                    <Badge variant="destructive" className="text-[10px] h-5">DNF</Badge>
                                                                ) : (
                                                                    <span className={`text-purple-600 ${entry.flagged ? 'text-yellow-600' : ''}`}>{formatTime(entry.average)}</span>
                                                                )
                                                            ) : (
                                                                entry.bestSingle === Infinity ? (
                                                                    <Badge variant="destructive" className="text-[10px] h-5">DNF</Badge>
                                                                ) : (
                                                                    <span className={`text-purple-600 ${entry.flagged ? 'text-yellow-600' : ''}`}>{formatTime(entry.bestSingle)}</span>
                                                                )
                                                            )
                                                        ) : <span className="text-gray-300">-</span>}
                                                    </TableCell>
                                                    <TableCell className="text-right text-gray-500 text-sm hidden sm:table-cell">
                                                        {entry.hasResults ? (sortBy === 'average' ? formatTime(entry.bestSingle) : formatTime(entry.average)) : <span className="text-gray-300">-</span>}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="sm" onClick={() => openUserDetails(entry)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{selectedUserResult?.userName}</DialogTitle>
                            <DialogDescription>
                                {getEventName(selectedEvent)} - Round {selectedRound}
                            </DialogDescription>
                        </DialogHeader>
                        {selectedUserResult && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                                        <p className="text-xs text-gray-500">Average</p>
                                        <p className="text-xl font-bold text-purple-600">{formatTimeDetailed(selectedUserResult.average)}</p>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                                        <p className="text-xs text-gray-500">Best Single</p>
                                        <p className="text-xl font-bold text-blue-600">{formatTimeDetailed(selectedUserResult.bestSingle)}</p>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                                        <p className="text-xs text-gray-500">Status</p>
                                        {selectedUserResult.qualifiedForNextRound ? (
                                            <Badge className="bg-green-100 text-green-700">Qualified</Badge>
                                        ) : selectedUserResult.disqualified ? (
                                            <Badge variant="destructive">Disqualified</Badge>
                                        ) : (
                                            <Badge variant="outline">Completed</Badge>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-semibold mb-2">Solves</h4>
                                    <div className="grid grid-cols-5 gap-2">
                                        {userSolves.map((solve, i) => (
                                            <div key={solve.id} className={`p-2 text-center rounded-lg border ${solve.penalty === 'DNF' ? 'bg-red-50 border-red-200' : solve.penalty === '+2' ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                                                <p className="text-xs text-gray-500">Attempt {i + 1}</p>
                                                <p className={`font-mono font-bold ${solve.penalty === 'DNF' ? 'text-red-600' : 'text-gray-900'}`}>
                                                    {solve.penalty === 'DNF' ? 'DNF' : formatTimeDetailed(solve.finalTime)}
                                                </p>
                                                {solve.penalty === '+2' && <p className="text-xs text-orange-600">+2</p>}
                                                {solve.flagged && <Flag className="h-3 w-3 text-yellow-500 mx-auto mt-1" />}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {selectedUserResult.flagLevel && (
                                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                            <span className="font-medium text-yellow-800">This result is under review</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}