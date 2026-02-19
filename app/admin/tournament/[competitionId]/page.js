'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, writeBatch, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
    ArrowLeft,
    RefreshCw,
    Trophy,
    Users,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Play,
    ChevronRight,
    Calculator,
    FileDown,
    Video,
    Edit3,
    Trash2,
    Award,
    Layers,
    Copy,
    Eye
} from 'lucide-react';
import { getEventName } from '@/lib/wcaEvents';
import {
    CompetitionMode,
    TournamentStatus,
    QualifyType,
    getRoundStatus,
    getRoundStatusLabel,
    getRoundStatusColor,
    calculateQualifiedCount,
    formatRoundDate
} from '@/lib/tournament';
import ScrambleDisplay from '@/components/ScrambleDisplay';

export default function TournamentManagementPage() {
    const { user, isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();

    const [competition, setCompetition] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [roundResults, setRoundResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedRound, setSelectedRound] = useState(1);
    const [simulationData, setSimulationData] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [viewingScramble, setViewingScramble] = useState(null);

    useEffect(() => {
        if (!authLoading) {
            if (!user) router.push('/auth/login');
            else if (!isAdmin) router.push('/');
        }
    }, [user, isAdmin, authLoading, router]);

    useEffect(() => {
        if (user && isAdmin && params.competitionId) {
            fetchTournamentData();
        }
    }, [user, isAdmin, params.competitionId]);

    async function fetchTournamentData() {
        setLoading(true);
        try {
            const compDoc = await getDoc(doc(db, 'competitions', params.competitionId));
            if (!compDoc.exists()) {
                alert('Competition not found');
                router.push('/admin');
                return;
            }

            const compData = { id: compDoc.id, ...compDoc.data() };
            if (compData.mode !== CompetitionMode.TOURNAMENT) {
                alert('This is not a tournament competition');
                router.push('/admin');
                return;
            }

            setCompetition(compData);
            setSelectedRound(compData.currentRound || 1);

            await Promise.all([
                fetchParticipants(),
                fetchRoundResults()
            ]);
        } catch (error) {
            console.error('Error fetching tournament data:', error);
            alert('Error loading tournament data');
        } finally {
            setLoading(false);
        }
    }

    async function fetchParticipants() {
        const participantsQuery = query(
            collection(db, 'tournamentParticipants'),
            where('competitionId', '==', params.competitionId)
        );
        const snapshot = await getDocs(participantsQuery);
        const participantsData = [];

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const userDoc = await getDoc(doc(db, 'users', data.userId));
            const userData = userDoc.exists() ? userDoc.data() : {};

            participantsData.push({
                id: docSnap.id,
                ...data,
                displayName: userData.displayName || data.userName || 'Unknown',
                photoURL: userData.photoURL,
                country: userData.country || 'Unknown'
            });
        }

        setParticipants(participantsData);
    }

    async function fetchRoundResults() {
        const resultsQuery = query(
            collection(db, 'roundResults'),
            where('competitionId', '==', params.competitionId)
        );
        const snapshot = await getDocs(resultsQuery);
        setRoundResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }

    function getRoundResultsForRound(roundNumber) {
        return roundResults.filter(r => r.roundNumber === roundNumber);
    }

    function getVerifiedCount(roundNumber) {
        const results = getRoundResultsForRound(roundNumber);
        return results.filter(r => r.verified).length;
    }

    function getTotalResultsCount(roundNumber) {
        return getRoundResultsForRound(roundNumber).length;
    }

    function simulateAdvancement() {
        if (!competition) return;

        const currentRoundNum = competition.currentRound || 1;
        const round = competition.rounds?.find(r => r.roundNumber === currentRoundNum);

        if (!round) return;

        const results = getRoundResultsForRound(currentRoundNum)
            .filter(r => r.verified)
            .sort((a, b) => {
                const aAvg = a.average === null || a.average === Infinity ? Infinity : a.average;
                const bAvg = b.average === null || b.average === Infinity ? Infinity : b.average;

                if (aAvg !== bAvg) return aAvg - bAvg;

                const aSingle = a.bestSingle === null || a.bestSingle === Infinity ? Infinity : a.bestSingle;
                const bSingle = b.bestSingle === null || b.bestSingle === Infinity ? Infinity : b.bestSingle;
                return aSingle - bSingle;
            });

        const totalParticipants = results.length;
        const qualifiedCount = calculateQualifiedCount(
            totalParticipants,
            round.qualifyType,
            round.qualifyValue
        );

        const qualified = results.slice(0, qualifiedCount);
        const eliminated = results.slice(qualifiedCount);

        setSimulationData({
            totalParticipants,
            qualifiedCount,
            qualified,
            eliminated,
            round
        });
    }

    async function confirmAdvancement() {
        if (!simulationData || !competition) return;

        if (!confirm(`Are you sure you want to advance to the next round?\n\n${simulationData.qualifiedCount} participants will qualify.`)) {
            return;
        }

        setProcessing(true);
        try {
            const batch = writeBatch(db);
            const currentRoundNum = competition.currentRound || 1;

            // Update qualified participants
            for (const result of simulationData.qualified) {
                const participantId = `${result.userId}_${params.competitionId}`;
                const participantRef = doc(db, 'tournamentParticipants', participantId);
                batch.update(participantRef, {
                    currentRound: currentRoundNum + 1,
                    qualified: true,
                    updatedAt: new Date().toISOString()
                });
            }

            // Update eliminated participants
            for (const result of simulationData.eliminated) {
                const participantId = `${result.userId}_${params.competitionId}`;
                const participantRef = doc(db, 'tournamentParticipants', participantId);
                batch.update(participantRef, {
                    eliminated: true,
                    updatedAt: new Date().toISOString()
                });
            }

            // Update competition
            const competitionRef = doc(db, 'competitions', params.competitionId);
            const nextRound = currentRoundNum + 1;
            const isFinalRound = competition.rounds?.find(r => r.roundNumber === currentRoundNum)?.isFinal;

            batch.update(competitionRef, {
                currentRound: nextRound,
                tournamentStatus: isFinalRound ? TournamentStatus.COMPLETED : TournamentStatus.ROUND_LIVE,
                updatedAt: new Date().toISOString()
            });

            await batch.commit();

            // Log the advancement
            await addDoc(collection(db, 'tournamentLogs'), {
                action: 'ROUND_ADVANCEMENT',
                competitionId: params.competitionId,
                fromRound: currentRoundNum,
                toRound: nextRound,
                qualifiedCount: simulationData.qualifiedCount,
                eliminatedCount: simulationData.eliminated.length,
                adminId: user.uid,
                adminEmail: user.email,
                timestamp: new Date().toISOString()
            });

            alert(`Round ${currentRoundNum} completed! ${simulationData.qualifiedCount} participants advanced to Round ${nextRound}.`);
            setSimulationData(null);
            fetchTournamentData();
        } catch (error) {
            console.error('Error advancing round:', error);
            alert('Error advancing round: ' + error.message);
        } finally {
            setProcessing(false);
        }
    }

    async function handleVerifyResult(resultId, verified) {
        try {
            await updateDoc(doc(db, 'roundResults', resultId), {
                verified,
                verifiedAt: new Date().toISOString(),
                verifiedBy: user.email
            });

            fetchRoundResults();
        } catch (error) {
            console.error('Error updating verification:', error);
            alert('Error updating verification status');
        }
    }

    async function handleUpdateResult(resultId, updates) {
        try {
            await updateDoc(doc(db, 'roundResults', resultId), updates);
            fetchRoundResults();
        } catch (error) {
            console.error('Error updating result:', error);
            alert('Error updating result');
        }
    }

    async function setTournamentStatus(status) {
        try {
            await updateDoc(doc(db, 'competitions', params.competitionId), {
                tournamentStatus: status,
                updatedAt: new Date().toISOString()
            });

            await addDoc(collection(db, 'tournamentLogs'), {
                action: 'STATUS_CHANGE',
                competitionId: params.competitionId,
                newStatus: status,
                adminId: user.uid,
                adminEmail: user.email,
                timestamp: new Date().toISOString()
            });

            fetchTournamentData();
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Error updating tournament status');
        }
    }

    const formatTime = (ms) => {
        if (ms === null || ms === undefined || ms === Infinity) return 'DNF';
        const seconds = (ms / 1000).toFixed(2);
        return `${seconds}s`;
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading Tournament Management...</p>
                </div>
            </div>
        );
    }

    if (!competition) return null;

    const currentRound = competition.rounds?.find(r => r.roundNumber === competition.currentRound);
    const roundStatus = currentRound ? getRoundStatus(currentRound, competition) : 'unknown';

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => router.push('/admin')}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Admin
                        </Button>
                        <Button variant="ghost" onClick={() => router.push(`/admin/results/${params.competitionId}`)} className="text-blue-600">
                            <Trophy className="h-4 w-4 mr-2" />
                            Results
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-2">
                                <Trophy className="h-8 w-8 text-indigo-600" />
                                {competition.name}
                            </h1>
                            <p className="text-gray-500 flex items-center gap-2">
                                <Layers className="h-4 w-4" />
                                Tournament Management
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={fetchTournamentData}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>

                {/* Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Current Round</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{competition.currentRound || 1}</div>
                            <p className="text-sm text-gray-500">of {competition.rounds?.length || 1}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Badge className={getRoundStatusColor(roundStatus)}>
                                {getRoundStatusLabel(roundStatus)}
                            </Badge>
                            <p className="text-sm text-gray-500 mt-1">{competition.tournamentStatus}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Participants</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{participants.length}</div>
                            <p className="text-sm text-gray-500">
                                {participants.filter(p => !p.eliminated).length} active
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Verified Results</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">
                                {getVerifiedCount(competition.currentRound || 1)}
                            </div>
                            <p className="text-sm text-gray-500">
                                of {getTotalResultsCount(competition.currentRound || 1)} submitted
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-5 lg:w-[750px]">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="scrambles">Scrambles</TabsTrigger>
                        <TabsTrigger value="verification">Verification</TabsTrigger>
                        <TabsTrigger value="advancement">Advancement</TabsTrigger>
                        <TabsTrigger value="participants">Participants</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Tournament Progress</CardTitle>
                                <CardDescription>Current status and round information</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {competition.rounds?.map((round, index) => {
                                        const isCurrentRound = round.roundNumber === competition.currentRound;
                                        const isCompleted = round.roundNumber < competition.currentRound;
                                        const status = getRoundStatus(round, competition);
                                        const results = getRoundResultsForRound(round.roundNumber);
                                        const verifiedCount = results.filter(r => r.verified).length;

                                        return (
                                            <div
                                                key={round.roundNumber}
                                                className={`p-4 rounded-lg border-2 ${isCurrentRound ? 'border-indigo-500 bg-indigo-50' :
                                                        isCompleted ? 'border-green-500 bg-green-50' :
                                                            'border-gray-200'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isCurrentRound ? 'bg-indigo-600 text-white' :
                                                                isCompleted ? 'bg-green-600 text-white' :
                                                                    'bg-gray-200 text-gray-600'
                                                            }`}>
                                                            {round.roundNumber}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-semibold">{round.name || `Round ${round.roundNumber}`}</h3>
                                                            <p className="text-sm text-gray-500">
                                                                {round.qualifyType === QualifyType.PERCENTAGE
                                                                    ? `Top ${round.qualifyValue}% advance`
                                                                    : `Top ${round.qualifyValue} advance`
                                                                }
                                                                {round.isFinal && ' • Final Round'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <Badge className={getRoundStatusColor(status)}>
                                                            {getRoundStatusLabel(status)}
                                                        </Badge>
                                                        <p className="text-sm text-gray-500 mt-1">
                                                            {verifiedCount} verified results
                                                        </p>
                                                    </div>
                                                </div>

                                                {round.scheduledDate && (
                                                    <p className="text-sm text-gray-500 mt-2">
                                                        Scheduled: {formatRoundDate(round.scheduledDate)}
                                                    </p>
                                                )}

                                                {round.requireVerification && (
                                                    <p className="text-sm text-orange-600 mt-1">
                                                        <AlertTriangle className="h-3 w-3 inline mr-1" />
                                                        Verification required
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {competition.winners && competition.winners.length > 0 && (
                                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                        <h3 className="font-semibold text-yellow-800 flex items-center gap-2">
                                            <Award className="h-5 w-5" />
                                            Tournament Winners
                                        </h3>
                                        <div className="mt-2 space-y-2">
                                            {competition.winners.map((winner, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <Badge className={
                                                        winner.position === 1 ? 'bg-yellow-500' :
                                                            winner.position === 2 ? 'bg-gray-400' :
                                                                'bg-orange-600'
                                                    }>
                                                        #{winner.position}
                                                    </Badge>
                                                    <span>{winner.userName || winner.userId}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="verification" className="space-y-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Result Verification</CardTitle>
                                    <CardDescription>Review and verify round results</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setTournamentStatus(TournamentStatus.VERIFICATION)}
                                        disabled={competition.tournamentStatus === TournamentStatus.VERIFICATION}
                                    >
                                        Start Verification
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => setTournamentStatus(TournamentStatus.ROUND_LIVE)}
                                        disabled={competition.tournamentStatus === TournamentStatus.ROUND_LIVE}
                                    >
                                        End Verification
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-4">
                                    <Label>Select Round</Label>
                                    <select
                                        className="w-full p-2 border rounded mt-1"
                                        value={selectedRound}
                                        onChange={(e) => setSelectedRound(parseInt(e.target.value))}
                                    >
                                        {competition.rounds?.map(round => (
                                            <option key={round.roundNumber} value={round.roundNumber}>
                                                {round.name || `Round ${round.roundNumber}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>User</TableHead>
                                                <TableHead>Event</TableHead>
                                                <TableHead>Average</TableHead>
                                                <TableHead>Best</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {getRoundResultsForRound(selectedRound).map((result) => (
                                                <TableRow key={result.id}>
                                                    <TableCell>
                                                        <div className="font-medium">{result.userName}</div>
                                                        <div className="text-xs text-gray-500">{result.wcaStyleId}</div>
                                                    </TableCell>
                                                    <TableCell>{getEventName(result.eventId)}</TableCell>
                                                    <TableCell className="font-mono">{formatTime(result.average)}</TableCell>
                                                    <TableCell className="font-mono">{formatTime(result.bestSingle)}</TableCell>
                                                    <TableCell>
                                                        {result.verified ? (
                                                            <Badge className="bg-green-100 text-green-700">
                                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                                Verified
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-orange-600">
                                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                                Pending
                                                            </Badge>
                                                        )}
                                                        {result.flagged && (
                                                            <Badge className="bg-red-100 text-red-700 ml-1">
                                                                Flagged
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-1">
                                                            <Button
                                                                size="sm"
                                                                variant={result.verified ? "destructive" : "outline"}
                                                                onClick={() => handleVerifyResult(result.id, !result.verified)}
                                                            >
                                                                {result.verified ? 'Unverify' : 'Verify'}
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {getRoundResultsForRound(selectedRound).length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                                        No results submitted for this round yet
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="advancement" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Round Advancement</CardTitle>
                                <CardDescription>Calculate qualifiers and advance to next round</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="p-4 bg-blue-50 rounded-lg">
                                        <h3 className="font-semibold text-blue-900 mb-2">
                                            Current Round: {currentRound?.name || `Round ${competition.currentRound}`}
                                        </h3>
                                        <p className="text-sm text-blue-700">
                                            Qualification: {currentRound?.qualifyType === QualifyType.PERCENTAGE
                                                ? `Top ${currentRound?.qualifyValue}%`
                                                : `Top ${currentRound?.qualifyValue} participants`
                                            }
                                        </p>
                                        <p className="text-sm text-blue-700">
                                            Verified Results: {getVerifiedCount(competition.currentRound || 1)}
                                        </p>
                                    </div>

                                    {!simulationData ? (
                                        <Button
                                            onClick={simulateAdvancement}
                                            className="w-full"
                                            disabled={getVerifiedCount(competition.currentRound || 1) === 0}
                                        >
                                            <Calculator className="h-4 w-4 mr-2" />
                                            Simulate Advancement
                                        </Button>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                                                <h3 className="font-semibold text-indigo-900 mb-2">Advancement Preview</h3>
                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div>
                                                        <p className="text-sm text-gray-600">Total Participants</p>
                                                        <p className="text-2xl font-bold">{simulationData.totalParticipants}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-gray-600">Will Qualify</p>
                                                        <p className="text-2xl font-bold text-green-600">{simulationData.qualifiedCount}</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <p className="font-medium text-sm">Qualified Participants:</p>
                                                    <div className="max-h-40 overflow-y-auto space-y-1">
                                                        {simulationData.qualified.map((result, idx) => (
                                                            <div key={result.userId} className="flex items-center gap-2 p-2 bg-green-100 rounded">
                                                                <span className="font-bold text-green-700 w-6">{idx + 1}</span>
                                                                <span className="flex-1">{result.userName}</span>
                                                                <span className="font-mono text-sm">{formatTime(result.average)}</span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {simulationData.eliminated.length > 0 && (
                                                        <>
                                                            <p className="font-medium text-sm mt-4">Eliminated Participants:</p>
                                                            <div className="max-h-40 overflow-y-auto space-y-1">
                                                                {simulationData.eliminated.map((result, idx) => (
                                                                    <div key={result.userId} className="flex items-center gap-2 p-2 bg-red-100 rounded">
                                                                        <span className="font-bold text-red-700 w-6">
                                                                            {simulationData.qualifiedCount + idx + 1}
                                                                        </span>
                                                                        <span className="flex-1">{result.userName}</span>
                                                                        <span className="font-mono text-sm">{formatTime(result.average)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setSimulationData(null)}
                                                    className="flex-1"
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    onClick={confirmAdvancement}
                                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                                                    disabled={processing}
                                                >
                                                    {processing ? (
                                                        <>
                                                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                                            Processing...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronRight className="h-4 w-4 mr-2" />
                                                            Confirm Advancement
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="participants" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Participant Management</CardTitle>
                                <CardDescription>View and manage tournament participants</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>WCA ID</TableHead>
                                                <TableHead>Current Round</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Registered Events</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {participants.map((participant) => (
                                                <TableRow key={participant.id}>
                                                    <TableCell>
                                                        <div className="font-medium">{participant.displayName}</div>
                                                        <div className="text-xs text-gray-500">{participant.userEmail}</div>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs">{participant.wcaStyleId}</TableCell>
                                                    <TableCell>Round {participant.currentRound}</TableCell>
                                                    <TableCell>
                                                        {participant.eliminated ? (
                                                            <Badge className="bg-red-100 text-red-700">Eliminated</Badge>
                                                        ) : participant.qualified ? (
                                                            <Badge className="bg-green-100 text-green-700">Qualified</Badge>
                                                        ) : (
                                                            <Badge variant="outline">Active</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            {participant.registeredEvents?.map(eventId => (
                                                                <Badge key={eventId} variant="outline" className="text-xs">
                                                                    {getEventName(eventId)}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="scrambles" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Round Scrambles</CardTitle>
                                <CardDescription>View and manage WCA-compliant scrambles for each round</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <p className="text-sm text-blue-800">
                                            <strong>Scramble Management:</strong> All scrambles should be WCA-compliant and entered manually when creating the competition.
                                            Scrambles are securely stored in Firebase and only visible to admins.
                                        </p>
                                    </div>

                                    {/* Current Round Scrambles Highlight */}
                                    {(() => {
                                        const currentRound = competition.rounds?.find(r => r.roundNumber === competition.currentRound);
                                        if (!currentRound) return null;

                                        const currentRoundHasScrambles = competition.scrambles &&
                                            Object.values(competition.scrambles).some(eventScrambles =>
                                                eventScrambles && eventScrambles[currentRound.roundNumber]
                                            );

                                        return (
                                            <div className="border-2 border-indigo-500 rounded-lg p-4 bg-indigo-50/30">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="font-semibold text-indigo-900 flex items-center gap-2 text-lg">
                                                        <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-sm flex items-center justify-center">
                                                            {currentRound.roundNumber}
                                                        </span>
                                                        {currentRound.name || `Round ${currentRound.roundNumber}`} - CURRENT ROUND
                                                        {currentRound.isFinal && <Badge className="bg-yellow-500 text-white ml-2">FINAL</Badge>}
                                                    </h3>
                                                    <Badge className={currentRoundHasScrambles ? 'bg-green-100 text-green-700 text-sm' : 'bg-red-100 text-red-700 text-sm'}>
                                                        {currentRoundHasScrambles ? '✓ Scrambles Ready' : '⚠ Missing Scrambles'}
                                                    </Badge>
                                                </div>

                                                {!currentRoundHasScrambles && (
                                                    <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                                                        <p className="text-sm text-red-700">
                                                            <strong>Warning:</strong> No scrambles configured for the current round!
                                                            Please add scrambles by editing the competition in the Admin panel.
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {competition.events?.map(eventId => {
                                                        const eventScrambles = competition.scrambles?.[eventId]?.[currentRound.roundNumber];
                                                        const scrambleCount = eventScrambles ? Object.keys(eventScrambles).length : 0;

                                                        return (
                                                            <div key={eventId} className={`p-3 rounded border-2 ${scrambleCount > 0 ? 'bg-white border-gray-200' : 'bg-red-50 border-red-200'}`}>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="font-medium">{getEventName(eventId)}</span>
                                                                    <Badge variant={scrambleCount > 0 ? "default" : "destructive"} className="text-xs">
                                                                        {scrambleCount > 0 ? `${scrambleCount} scrambles` : 'Missing'}
                                                                    </Badge>
                                                                </div>
                                                                {scrambleCount > 0 ? (
                                                                    <div className="space-y-1">
                                                                        {Object.entries(eventScrambles)
                                                                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                                                            .map(([idx, scramble]) => (
                                                                                <div key={idx} className="text-xs font-mono bg-gray-50 p-2 rounded border flex justify-between items-center">
                                                                                    <span className="truncate flex-1 mr-2">
                                                                                        <strong>#{parseInt(idx) + 1}</strong> {scramble}
                                                                                    </span>
                                                                                    <div className="flex gap-1">
                                                                                        <Button
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            className="h-6 px-2 shrink-0"
                                                                                            onClick={() => setViewingScramble({ eventId, scramble, idx })}
                                                                                        >
                                                                                            <Eye className="h-3 w-3" />
                                                                                        </Button>
                                                                                        <Button
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            className="h-6 px-2 shrink-0"
                                                                                            onClick={() => {
                                                                                                navigator.clipboard.writeText(scramble);
                                                                                                alert('Scramble copied to clipboard!');
                                                                                            }}
                                                                                        >
                                                                                            <Copy className="h-3 w-3" />
                                                                                        </Button>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-xs text-red-600 font-medium">⚠ No scrambles configured</p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="border-t pt-4">
                                        <h3 className="font-semibold mb-4">All Rounds</h3>

                                        {competition.rounds?.map((round) => {
                                            const isCurrentRound = round.roundNumber === competition.currentRound;
                                            const hasScrambles = competition.scrambles &&
                                                Object.values(competition.scrambles).some(eventScrambles =>
                                                    eventScrambles && eventScrambles[round.roundNumber]
                                                );

                                            return (
                                                <div key={round.roundNumber} className={`border rounded-lg p-4 mb-4 ${isCurrentRound ? 'ring-2 ring-indigo-500' : ''}`}>
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h3 className="font-semibold flex items-center gap-2">
                                                            <span className={`w-6 h-6 rounded-full text-white text-xs flex items-center justify-center ${round.roundNumber === competition.currentRound ? 'bg-indigo-600' : 'bg-gray-400'
                                                                }`}>
                                                                {round.roundNumber}
                                                            </span>
                                                            {round.name || `Round ${round.roundNumber}`}
                                                            {round.isFinal && <Badge className="bg-yellow-500 text-white ml-2">Final</Badge>}
                                                        </h3>
                                                        <div className="flex items-center gap-2">
                                                            <Badge className={hasScrambles ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                                                {hasScrambles ? 'Scrambles Set' : 'No Scrambles'}
                                                            </Badge>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {competition.events?.map(eventId => {
                                                            const eventScrambles = competition.scrambles?.[eventId]?.[round.roundNumber];
                                                            const scrambleCount = eventScrambles ? Object.keys(eventScrambles).length : 0;

                                                            return (
                                                                <div key={eventId} className="bg-gray-50 p-3 rounded">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <span className="font-medium text-sm">{getEventName(eventId)}</span>
                                                                        <div className="flex items-center gap-2">
                                                                            <Badge variant="outline" className="text-xs">
                                                                                {scrambleCount} scrambles
                                                                            </Badge>
                                                                            {scrambleCount > 0 && (
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    className="h-6 px-2"
                                                                                    onClick={() => {
                                                                                        const allScrambles = Object.entries(eventScrambles)
                                                                                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                                                                            .map(([idx, scramble]) => `Attempt ${parseInt(idx) + 1}: ${scramble}`)
                                                                                            .join('\n');
                                                                                        navigator.clipboard.writeText(allScrambles);
                                                                                        alert(`All ${getEventName(eventId)} scrambles copied!`);
                                                                                    }}
                                                                                >
                                                                                    <Copy className="h-3 w-3" />
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {scrambleCount > 0 ? (
                                                                        <div className="space-y-1 max-h-40 overflow-y-auto">
                                                                            {Object.entries(eventScrambles)
                                                                                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                                                                .slice(0, 2) // Show first 2 only
                                                                                .map(([idx, scramble]) => (
                                                                                    <div key={idx} className="text-xs font-mono bg-white p-2 rounded border truncate">
                                                                                        {parseInt(idx) + 1}. {scramble}
                                                                                    </div>
                                                                                ))}
                                                                            {scrambleCount > 2 && (
                                                                                <p className="text-xs text-gray-500 text-center">+{scrambleCount - 2} more scrambles</p>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-xs text-red-500">No scrambles configured</p>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Scramble Viewer Modal */}
                {viewingScramble && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-lg max-w-lg w-full p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">
                                    {getEventName(viewingScramble.eventId)} Scramble #{parseInt(viewingScramble.idx) + 1}
                                </h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewingScramble(null)}
                                >
                                    ✕
                                </Button>
                            </div>

                            <div className="flex flex-col items-center gap-4">
                                {/* Scramble Visualization */}
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <ScrambleDisplay
                                        eventId={viewingScramble.eventId}
                                        scramble={viewingScramble.scramble}
                                        visualization="2D"
                                        width={250}
                                        height={250}
                                        checkered={true}
                                    />
                                </div>

                                {/* Scramble Text */}
                                <div className="w-full">
                                    <p className="text-sm font-mono bg-gray-100 p-3 rounded break-words">
                                        {viewingScramble.scramble}
                                    </p>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2 w-full">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => {
                                            navigator.clipboard.writeText(viewingScramble.scramble);
                                            alert('Scramble copied to clipboard!');
                                        }}
                                    >
                                        <Copy className="h-4 w-4 mr-2" />
                                        Copy Scramble
                                    </Button>
                                    <Button
                                        className="flex-1"
                                        onClick={() => setViewingScramble(null)}
                                    >
                                        Close
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}