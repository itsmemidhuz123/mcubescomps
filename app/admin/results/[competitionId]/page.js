'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
    doc, getDoc, collection, query, where, getDocs, updateDoc,
    writeBatch, addDoc, deleteDoc, orderBy, limit
} from 'firebase/firestore';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    ArrowLeft, RefreshCw, Trophy, Users, CheckCircle, XCircle, AlertTriangle,
    Play, ChevronRight, Calculator, FileDown, Video, Lock, Unlock,
    Trash2, Award, Layers, Eye, Search, Filter, Flag, Ban, Shield,
    Clock, Monitor, Smartphone, Globe, FileText, Check, X, Save,
    AlertOctagon, Info, Send, UserCheck, UserX, ArrowUpCircle
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

function formatTime(ms) {
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

export default function ResultsManagementPage() {
    const { user, isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();

    const [competition, setCompetition] = useState(null);
    const [results, setResults] = useState([]);
    const [users, setUsers] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [selectedRound, setSelectedRound] = useState(1);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [processing, setProcessing] = useState(false);

    const [selectedUser, setSelectedUser] = useState(null);
    const [userSolves, setUserSolves] = useState([]);
    const [showUserModal, setShowUserModal] = useState(false);
    const [showNoteModal, setShowNoteModal] = useState(false);
    const [noteContent, setNoteContent] = useState('');
    const [noteType, setNoteType] = useState('solve');
    const [editingSolveId, setEditingSolveId] = useState(null);
    const [overrideTime, setOverrideTime] = useState('');
    const [manualFlag, setManualFlag] = useState('');

    const [verificationQueue, setVerificationQueue] = useState([]);
    const [simulationData, setSimulationData] = useState(null);

    useEffect(() => {
        if (!authLoading) {
            if (!user) router.push('/auth/login');
            else if (!isAdmin) router.push('/');
        }
    }, [user, isAdmin, authLoading, router]);

    useEffect(() => {
        if (user && isAdmin && params.competitionId) {
            fetchCompetitionData();
        }
    }, [user, isAdmin, params.competitionId]);

    useEffect(() => {
        if (competition && user && isAdmin) {
            fetchResults(competition, selectedRound, selectedEvent);
        }
    }, [selectedRound, selectedEvent, competition, user, isAdmin]);

    async function fetchCompetitionData() {
        setLoading(true);
        try {
            const compDoc = await getDoc(doc(db, 'competitions', params.competitionId));
            if (!compDoc.exists()) {
                alert('Competition not found');
                router.push('/admin');
                return;
            }

            const compData = { id: compDoc.id, ...compDoc.data() };
            setCompetition(compData);
            setSelectedRound(compData.currentRound || 1);
            setSelectedEvent(compData.events?.[0] || null);

            await Promise.all([
                fetchResults(compData, compData.currentRound || 1, compData.events?.[0]),
                fetchVerificationQueue()
            ]);
        } catch (error) {
            console.error('Error fetching competition data:', error);
            alert('Error loading competition data');
        } finally {
            setLoading(false);
        }
    }

    async function fetchResults(compData, forceRound = null, forceEvent = null) {
        const round = forceRound !== null ? forceRound : (selectedRound || compData.currentRound || 1);
        const event = forceEvent !== null ? forceEvent : (selectedEvent || compData.events?.[0]);

        try {
            console.log('Fetching results for round:', round, 'event:', event);

            // Fetch all and filter client-side (avoid index requirement)
            const snapshot = await getDocs(collection(db, 'results'));
            let resultsData = [];

            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                if (data.competitionId === params.competitionId) {
                    resultsData.push({ id: docSnap.id, ...data });
                }
            });

            console.log('Total results found:', resultsData.length);

            // Filter by event first
            if (event) {
                resultsData = resultsData.filter(d => d.eventId === event);
            }

            // Filter by round - show users competing in this round
            const currentRoundNum = round;
            resultsData = resultsData.filter(d => {
                // Show in round 1 if no roundNumber set (legacy data)
                if ((d.roundNumber === undefined || d.roundNumber === null)) {
                    return currentRoundNum === 1;
                }
                // Exact match for current round
                return d.roundNumber === currentRoundNum;
            });

            console.log('Results after filtering:', resultsData.length);

            // Sort by average
            resultsData.sort((a, b) => {
                const aAvg = a.average || Infinity;
                const bAvg = b.average || Infinity;
                return aAvg - bAvg;
            });

            // Fetch user data
            const usersCache = { ...users };
            for (const result of resultsData) {
                if (!usersCache[result.userId]) {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', result.userId));
                        if (userDoc.exists()) {
                            usersCache[result.userId] = userDoc.data();
                        }
                    } catch (e) {
                        console.error('Error fetching user:', e);
                    }
                }
                result.user = usersCache[result.userId] || {};
            }

            setUsers(usersCache);
            setResults(resultsData);
            console.log('Results set:', resultsData.length);
        } catch (error) {
            console.error('Error fetching results:', error);
            setResults([]);
        }
    }

    async function fetchVerificationQueue() {
        // Fetch all and filter client-side
        const snapshot = await getDocs(collection(db, 'videoSubmissions'));
        const allSubmissions = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(d => d.competitionId === params.competitionId)
            .sort((a, b) => {
                const aTime = a.submittedAt?.toDate?.() || new Date(a.submittedAt || 0);
                const bTime = b.submittedAt?.toDate?.() || new Date(b.submittedAt || 0);
                return bTime - aTime;
            });
        setVerificationQueue(allSubmissions);
    }

    function getStats() {
        const totalParticipants = results.length;
        const flaggedSolves = results.filter(r => r.flagged || r.autoFlag || r.manualFlag).length;
        const suspiciousUsers = new Set(results.filter(r => (r.suspicionScore || 0) > 50).map(r => r.userId)).size;
        const verifiedUsers = results.filter(r => r.adminVerified).length;
        const disqualifiedUsers = results.filter(r => r.disqualified).length;

        return {
            totalParticipants,
            totalSolves: totalParticipants * 5,
            flaggedSolves,
            suspiciousUsers,
            verifiedUsers,
            disqualifiedUsers
        };
    }

    function getRoundStatusInfo() {
        if (!competition) return 'unknown';
        const round = competition.rounds?.find(r => r.roundNumber === selectedRound);
        if (!round) return 'unknown';
        return getRoundStatus(round, competition);
    }

    async function logAuditAction(action, userId, details = {}) {
        await addDoc(collection(db, 'auditLogs'), {
            action,
            adminId: user.uid,
            adminEmail: user.email,
            competitionId: params.competitionId,
            userId,
            details,
            timestamp: new Date().toISOString()
        });
    }

    async function handleVideoVerification(submissionId, status, reason = null, note = null) {
        try {
            const updates = {
                verificationStatus: status,
                reviewedBy: user.uid,
                reviewedAt: new Date().toISOString()
            };

            if (reason) {
                updates.verificationNote = reason;
            }

            if (note) {
                updates.adminNote = note;
            }

            await updateDoc(doc(db, 'videoSubmissions', submissionId), updates);

            await logAuditAction(`VIDEO_${status.toUpperCase()}`, null, { submissionId, reason, note });

            // If rejected, update qualifiedForNextRound to false
            if (status === 'rejected') {
                // Find the user and update their qualification status
                const sub = verificationQueue.find(s => s.id === submissionId);
                if (sub) {
                    const resultsQuery = query(
                        collection(db, 'results'),
                        where('competitionId', '==', params.competitionId),
                        where('userId', '==', sub.userId)
                    );
                    const resultSnap = await getDocs(resultsQuery);
                    if (!resultSnap.empty) {
                        await updateDoc(doc(db, 'results', resultSnap.docs[0].id), {
                            qualifiedForNextRound: false,
                            verificationStatus: 'rejected'
                        });
                    }
                }
            }

            // If approved, also update results
            if (status === 'approved') {
                const sub = verificationQueue.find(s => s.id === submissionId);
                if (sub) {
                    const resultsQuery = query(
                        collection(db, 'results'),
                        where('competitionId', '==', params.competitionId),
                        where('userId', '==', sub.userId)
                    );
                    const resultSnap = await getDocs(resultsQuery);
                    if (!resultSnap.empty) {
                        await updateDoc(doc(db, 'results', resultSnap.docs[0].id), {
                            verificationStatus: 'approved',
                            adminVerified: true
                        });
                    }
                }
            }

            fetchVerificationQueue();
            alert(`Video ${status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'updated'} successfully`);
        } catch (error) {
            console.error('Error updating video verification:', error);
            alert('Error: ' + error.message);
        }
    }

    async function handleSolveAction(solveId, action, value = null) {
        try {
            const solveRef = doc(db, 'solves', solveId);
            const updates = {};

            switch (action) {
                case 'plus2':
                    updates.penalty = '+2';
                    updates.finalTime = (value || 0) + 2000;
                    break;
                case 'dnf':
                    updates.penalty = 'DNF';
                    updates.finalTime = null;
                    break;
                case 'remove_flag':
                    updates.flagged = false;
                    updates.autoFlag = false;
                    updates.manualFlag = null;
                    updates.flagReason = null;
                    break;
                case 'add_flag':
                    updates.flagged = true;
                    updates.manualFlag = value;
                    updates.flagReason = `Manual: ${value}`;
                    break;
                case 'delete':
                    await deleteDoc(solveRef);
                    await logAuditAction('SOLVE_DELETED', null, { solveId });
                    alert('Solve deleted');
                    fetchResults(competition, selectedRound, selectedEvent);
                    return;
                case 'override':
                    const ms = parseFloat(value) * 1000;
                    updates.time = ms;
                    updates.finalTime = ms;
                    updates.penalty = 'none';
                    break;
                case 'verify':
                    updates.adminVerified = value;
                    break;
                case 'note':
                    updates.adminNote = value;
                    break;
            }

            updates.updatedAt = new Date().toISOString();
            await updateDoc(solveRef, updates);

            await logAuditAction(`SOLVE_${action.toUpperCase()}`, null, { solveId, value });

            await fetchUserSolves(selectedUser?.userId);

            // Refresh results after verification
            const compDoc = await getDoc(doc(db, 'competitions', params.competitionId));
            if (compDoc.exists()) {
                const compData = { id: compDoc.id, ...compDoc.data() };
                setCompetition(compData);
                await fetchResults(compData, selectedRound, selectedEvent);
            }
        } catch (error) {
            console.error('Error updating solve:', error);
            alert('Error: ' + error.message);
        }
    }

    async function handleUserAction(userId, action, value = null) {
        try {
            const userRef = doc(db, 'users', userId);
            const participantRef = doc(db, 'tournamentParticipants', `${userId}_${params.competitionId}`);

            switch (action) {
                case 'approve_all':
                    // Approve all solves in solves collection
                    const solvesQuery = query(
                        collection(db, 'solves'),
                        where('competitionId', '==', params.competitionId),
                        where('userId', '==', userId)
                    );
                    const solvesSnap = await getDocs(solvesQuery);
                    const batch = writeBatch(db);
                    solvesSnap.docs.forEach(solveDoc => {
                        batch.update(solveDoc.ref, { adminVerified: true });
                    });
                    await batch.commit();

                    // Also update results collection
                    const approveResultsQuery = query(
                        collection(db, 'results'),
                        where('competitionId', '==', params.competitionId),
                        where('userId', '==', userId)
                    );
                    const approveResultsSnap = await getDocs(approveResultsQuery);
                    if (!approveResultsSnap.empty) {
                        await updateDoc(doc(db, 'results', approveResultsSnap.docs[0].id), {
                            adminVerified: true,
                            verified: true
                        });
                    }

                    // Also update roundResults collection
                    const approveRoundResultsQuery = query(
                        collection(db, 'roundResults'),
                        where('competitionId', '==', params.competitionId),
                        where('userId', '==', userId)
                    );
                    const approveRoundResultsSnap = await getDocs(approveRoundResultsQuery);
                    if (!approveRoundResultsSnap.empty) {
                        await updateDoc(doc(db, 'roundResults', approveRoundResultsSnap.docs[0].id), {
                            adminVerified: true,
                            verified: true
                        });
                    }
                    break;
                case 'disqualify':
                    const resultQuery = query(
                        collection(db, 'results'),
                        where('competitionId', '==', params.competitionId),
                        where('userId', '==', userId)
                    );
                    const resultSnap = await getDocs(resultQuery);
                    const dqBatch = writeBatch(db);
                    dqBatch.update(doc(db, 'results', resultSnap.docs[0].id), {
                        disqualified: true,
                        adminNote: value || 'Disqualified by admin'
                    });
                    await dqBatch.commit();
                    break;
                case 'ban':
                    await updateDoc(userRef, { status: 'SUSPENDED' });
                    break;
                case 'lock':
                    await updateDoc(participantRef, { resultLocked: true });
                    break;
                case 'unlock':
                    await updateDoc(participantRef, { resultLocked: false });
                    break;
                case 'note':
                    await updateDoc(userRef, {
                        adminNote: value,
                        adminNoteUpdatedAt: new Date().toISOString()
                    });
                    break;
                case 'promote':
                    const participantDoc = await getDoc(participantRef);
                    const nextRound = selectedRound + 1;

                    // Update tournament participant
                    if (participantDoc.exists()) {
                        await updateDoc(participantRef, {
                            qualified: true,
                            qualifiedForNextRound: true,
                            currentRound: nextRound,
                            updatedAt: new Date().toISOString()
                        });
                    }

                    // Update results collection - mark as qualified but keep in current round
                    const promoteResultsQuery = query(
                        collection(db, 'results'),
                        where('competitionId', '==', params.competitionId),
                        where('userId', '==', userId)
                    );
                    const promoteResultsSnap = await getDocs(promoteResultsQuery);
                    if (!promoteResultsSnap.empty) {
                        await updateDoc(doc(db, 'results', promoteResultsSnap.docs[0].id), {
                            qualifiedForNextRound: true,
                            adminVerified: true
                        });
                    }

                    // Also update roundResults collection
                    const promoteRoundResultsQuery = query(
                        collection(db, 'roundResults'),
                        where('competitionId', '==', params.competitionId),
                        where('userId', '==', userId)
                    );
                    const promoteRoundResultsSnap = await getDocs(promoteRoundResultsQuery);
                    if (!promoteRoundResultsSnap.empty) {
                        await updateDoc(doc(db, 'roundResults', promoteRoundResultsSnap.docs[0].id), {
                            qualifiedForNextRound: true,
                            verified: true
                        });
                    }
                    break;
            }

            await logAuditAction(`USER_${action.toUpperCase()}`, userId, { value });

            await fetchUserSolves(userId);

            // Refresh competition data and results
            const compDoc = await getDoc(doc(db, 'competitions', params.competitionId));
            if (compDoc.exists()) {
                const compData = { id: compDoc.id, ...compDoc.data() };
                setCompetition(compData);
                await fetchResults(compData, selectedRound, selectedEvent);
            }

            // Show success message
            if (action === 'promote') {
                alert(`User promoted to Round ${selectedRound + 1} successfully!`);
            } else if (action === 'approve_all') {
                alert('All solves approved successfully!');
            } else if (action === 'disqualify') {
                alert('User disqualified!');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        }
    }

    async function openUserDetail(result) {
        const userData = users[result.userId] || result;
        setSelectedUser({ ...result, ...userData });
        await fetchUserSolves(result.userId);
        setShowUserModal(true);
    }

    async function fetchUserSolves(userId) {
        // Fetch all and filter client-side (avoid index requirement)
        const snapshot = await getDocs(collection(db, 'solves'));
        const solves = [];
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.competitionId === params.competitionId && data.userId === userId) {
                solves.push({ id: doc.id, ...data });
            }
        });
        solves.sort((a, b) => (a.attemptNumber || 0) - (b.attemptNumber || 0));
        setUserSolves(solves);
    }

    async function processQualification() {
        if (!competition) return;

        const round = competition.rounds?.find(r => r.roundNumber === selectedRound);
        if (!round) {
            alert('Round configuration not found');
            return;
        }

        const verifiedResults = results
            .filter(r => r.adminVerified && !r.disqualified)
            .sort((a, b) => {
                const aAvg = a.average || Infinity;
                const bAvg = b.average || Infinity;
                return aAvg - bAvg;
            });

        const qualifiedCount = calculateQualifiedCount(
            verifiedResults.length,
            round.qualifyType,
            round.qualifyValue
        );

        const qualified = verifiedResults.slice(0, qualifiedCount);
        const eliminated = verifiedResults.slice(qualifiedCount);

        setSimulationData({
            totalParticipants: verifiedResults.length,
            qualifiedCount,
            qualified,
            eliminated,
            round
        });
    }

    async function confirmQualification() {
        if (!simulationData) return;

        if (!confirm(`Confirm qualification?\n\n${simulationData.qualifiedCount} users will qualify for next round.`)) {
            return;
        }

        setProcessing(true);
        try {
            const batch = writeBatch(db);

            for (const result of simulationData.qualified) {
                const participantId = `${result.userId}_${params.competitionId}`;
                const participantRef = doc(db, 'tournamentParticipants', participantId);
                batch.update(participantRef, {
                    qualified: true,
                    qualifiedForNextRound: true,
                    qualificationRank: simulationData.qualified.indexOf(result) + 1,
                    updatedAt: new Date().toISOString()
                });

                const resultRef = doc(db, 'results', result.id);
                batch.update(resultRef, { qualifiedForNextRound: true });
            }

            for (const result of simulationData.eliminated) {
                const participantId = `${result.userId}_${params.competitionId}`;
                const participantRef = doc(db, 'tournamentParticipants', participantId);
                batch.update(participantRef, {
                    eliminated: true,
                    qualified: false,
                    updatedAt: new Date().toISOString()
                });
            }

            const nextRound = selectedRound + 1;
            const isFinalRound = competition.rounds?.find(r => r.roundNumber === selectedRound)?.isFinal;

            const compRef = doc(db, 'competitions', params.competitionId);
            batch.update(compRef, {
                currentRound: nextRound,
                tournamentStatus: isFinalRound ? TournamentStatus.COMPLETED : TournamentStatus.ROUND_LIVE,
                updatedAt: new Date().toISOString()
            });

            await batch.commit();

            await logAuditAction('ROUND_QUALIFICATION_PROCESSED', null, {
                round: selectedRound,
                qualified: simulationData.qualifiedCount,
                eliminated: simulationData.eliminated.length
            });

            alert(`Qualification complete! ${simulationData.qualifiedCount} users qualified.`);
            setSimulationData(null);
            fetchCompetitionData();
        } catch (error) {
            console.error('Error processing qualification:', error);
            alert('Error: ' + error.message);
        } finally {
            setProcessing(false);
        }
    }

    async function toggleRoundLock(lock) {
        try {
            const compRef = doc(db, 'competitions', params.competitionId);
            await updateDoc(compRef, {
                [`roundLocked.${selectedRound}`]: lock,
                updatedAt: new Date().toISOString()
            });

            await logAuditAction(lock ? 'ROUND_LOCKED' : 'ROUND_UNLOCKED', null, { round: selectedRound });

            fetchCompetitionData();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }

    function exportCSV(type) {
        let data = results;
        let filename = `results_${params.competitionId}`;

        if (type === 'flagged') {
            data = results.filter(r => r.flagged || r.autoFlag || r.manualFlag);
            filename += '_flagged';
        } else if (type === 'qualified') {
            data = results.filter(r => r.qualifiedForNextRound);
            filename += '_qualified';
        }

        const headers = ['Rank', 'Name', 'WCA ID', 'Event', 'Average', 'Best Single', 'Flagged', 'Verified', 'Qualified'];
        const rows = data.map((r, idx) => [
            idx + 1,
            r.userName || r.user?.displayName,
            r.wcaStyleId || r.user?.wcaStyleId,
            getEventName(r.eventId),
            formatTime(r.average),
            formatTime(r.bestSingle),
            r.flagged || r.autoFlag || r.manualFlag ? 'Yes' : 'No',
            r.adminVerified ? 'Yes' : 'No',
            r.qualifiedForNextRound ? 'Yes' : 'No'
        ]);

        const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    }

    const filteredResults = results.filter(r => {
        if (!searchQuery) return true;
        const name = (r.userName || r.user?.displayName || '').toLowerCase();
        const wcaId = (r.wcaStyleId || r.user?.wcaStyleId || '').toLowerCase();
        return name.includes(searchQuery.toLowerCase()) || wcaId.includes(searchQuery.toLowerCase());
    });

    const stats = getStats();
    const isRoundLocked = competition?.roundLocked?.[selectedRound];

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading Results Management...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => router.push('/admin')}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Trophy className="h-6 w-6 text-indigo-600" />
                                Results Management
                            </h1>
                            <p className="text-gray-500">{competition?.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={selectedRound?.toString()} onValueChange={(v) => { const newRound = parseInt(v); setSelectedRound(newRound); fetchResults(competition, newRound, selectedEvent); }}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Select Round" />
                            </SelectTrigger>
                            <SelectContent>
                                {competition?.rounds?.map(round => (
                                    <SelectItem key={round.roundNumber} value={round.roundNumber.toString()}>
                                        {round.name || `Round ${round.roundNumber}`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={fetchCompetitionData}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Participants</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalParticipants}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Solves</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalSolves}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Flagged</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-600">{stats.flaggedSolves}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Suspicious</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">{stats.suspiciousUsers}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Verified</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{stats.verifiedUsers}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Disqualified</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">{stats.disqualifiedUsers}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Badge className={getRoundStatusColor(getRoundStatusInfo())}>
                                {getRoundStatusLabel(getRoundStatusInfo())}
                            </Badge>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button
                            variant={isRoundLocked ? "destructive" : "outline"}
                            size="sm"
                            onClick={() => toggleRoundLock(!isRoundLocked)}
                        >
                            {isRoundLocked ? <Lock className="h-4 w-4 mr-2" /> : <Unlock className="h-4 w-4 mr-2" />}
                            {isRoundLocked ? 'Locked' : 'Unlock'}
                        </Button>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search user..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 w-[250px]"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => exportCSV('all')}>
                            <FileDown className="h-4 w-4 mr-2" />
                            Export All
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportCSV('flagged')}>
                            <Flag className="h-4 w-4 mr-2" />
                            Export Flagged
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportCSV('qualified')}>
                            <Award className="h-4 w-4 mr-2" />
                            Export Qualified
                        </Button>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="dashboard">Results</TabsTrigger>
                        <TabsTrigger value="verification">
                            <Video className="h-4 w-4 mr-2" />
                            Verification
                            {verificationQueue.length > 0 && (
                                <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 text-[10px]">
                                    {verificationQueue.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="qualification">
                            <Calculator className="h-4 w-4 mr-2" />
                            Qualification
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="dashboard">
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Rank</TableHead>
                                            <TableHead>User</TableHead>
                                            <TableHead>Event</TableHead>
                                            <TableHead>Average</TableHead>
                                            <TableHead>Best</TableHead>
                                            <TableHead>Score</TableHead>
                                            <TableHead>Flag</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredResults.map((result, idx) => (
                                            <TableRow key={result.id} className={result.disqualified ? 'bg-red-50' : ''}>
                                                <TableCell className="font-bold">{idx + 1}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={result.user?.photoURL} />
                                                            <AvatarFallback>{(result.userName || result.user?.displayName || 'U').charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <div className="font-medium">{result.userName || result.user?.displayName}</div>
                                                            <div className="text-xs text-gray-500">{result.wcaStyleId || result.user?.wcaStyleId || 'N/A'}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{getEventName(result.eventId)}</TableCell>
                                                <TableCell className="font-mono font-bold">{formatTime(result.average)}</TableCell>
                                                <TableCell className="font-mono">{formatTime(result.bestSingle)}</TableCell>
                                                <TableCell>
                                                    {(result.suspicionScore || result.anomalyScore || 0) > 0 && (
                                                        <Badge variant={result.suspicionScore > 50 ? "destructive" : "outline"}>
                                                            {result.suspicionScore || result.anomalyScore}
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {result.flagged || result.autoFlag || result.manualFlag ? (
                                                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                                            <Flag className="h-3 w-3" />
                                                            {(result.flagLevel || 'Low').charAt(0).toUpperCase()}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-green-600">Clean</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {result.disqualified ? (
                                                        <Badge variant="destructive">DQ</Badge>
                                                    ) : result.adminVerified ? (
                                                        <Badge className="bg-green-100 text-green-700">Verified</Badge>
                                                    ) : (
                                                        <Badge variant="outline">Pending</Badge>
                                                    )}
                                                    {result.qualifiedForNextRound && (
                                                        <Badge className="bg-blue-100 text-blue-700 ml-1">Q</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="sm" onClick={() => openUserDetail(result)}>
                                                        <Eye className="h-4 w-4 mr-1" />
                                                        View
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {filteredResults.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                                                    No results found
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="verification">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Video className="h-5 w-5" />
                                    Video Submission Verification
                                </CardTitle>
                                <CardDescription>Review users who submitted video evidence</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {verificationQueue.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500">
                                        <Video className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                        <p>No pending video submissions</p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>User</TableHead>
                                                <TableHead>Round</TableHead>
                                                <TableHead>Event</TableHead>
                                                <TableHead>Video Link</TableHead>
                                                <TableHead>Submitted</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {verificationQueue.map(sub => (
                                                <TableRow key={sub.id}>
                                                    <TableCell>
                                                        <div className="font-medium">{sub.userName}</div>
                                                        <div className="text-xs text-gray-500">{sub.userEmail}</div>
                                                    </TableCell>
                                                    <TableCell>Round {sub.roundNumber || 1}</TableCell>
                                                    <TableCell>{getEventName(sub.eventId)}</TableCell>
                                                    <TableCell>
                                                        <a href={sub.videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                                                            <Eye className="h-4 w-4" />
                                                            View Video
                                                        </a>
                                                    </TableCell>
                                                    <TableCell>
                                                        {new Date(sub.submittedAt?.toDate?.() || sub.submittedAt).toLocaleString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={sub.verificationStatus === 'approved' ? 'default' : sub.verificationStatus === 'rejected' ? 'destructive' : 'outline'}>
                                                            {sub.verificationStatus || 'pending'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-1">
                                                            <Button size="sm" variant="outline" className="text-green-600 h-8" title="Approve" onClick={() => handleVideoVerification(sub.id, 'approved')}>
                                                                <CheckCircle className="h-4 w-4" />
                                                            </Button>
                                                            <Button size="sm" variant="outline" className="text-red-600 h-8" title="Reject" onClick={() => {
                                                                const reason = prompt('Enter rejection reason:');
                                                                if (reason) handleVideoVerification(sub.id, 'rejected', reason);
                                                            }}>
                                                                <XCircle className="h-4 w-4" />
                                                            </Button>
                                                            <Button size="sm" variant="outline" className="text-orange-600 h-8" title="Request Reupload" onClick={() => {
                                                                const reason = prompt('Enter reason for reupload request:');
                                                                if (reason) handleVideoVerification(sub.id, 'reupload_requested', reason);
                                                            }}>
                                                                <RefreshCw className="h-4 w-4" />
                                                            </Button>
                                                            <Button size="sm" variant="outline" className="text-gray-600 h-8" title="Add Note" onClick={() => {
                                                                const note = prompt('Add admin note:');
                                                                if (note) handleVideoVerification(sub.id, sub.verificationStatus, null, note);
                                                            }}>
                                                                <FileText className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="qualification">
                        <Card>
                            <CardHeader>
                                <CardTitle>Round Qualification</CardTitle>
                                <CardDescription>Process qualification for next round</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="p-4 bg-blue-50 rounded-lg">
                                        <h3 className="font-semibold text-blue-900 mb-2">
                                            Round {selectedRound}: {competition?.rounds?.find(r => r.roundNumber === selectedRound)?.name || `Round ${selectedRound}`}
                                        </h3>
                                        <p className="text-sm text-blue-700">
                                            Qualification: {competition?.rounds?.find(r => r.roundNumber === selectedRound)?.qualifyType === QualifyType.PERCENTAGE
                                                ? `Top ${competition?.rounds?.find(r => r.roundNumber === selectedRound)?.qualifyValue}%`
                                                : `Top ${competition?.rounds?.find(r => r.roundNumber === selectedRound)?.qualifyValue} participants`
                                            }
                                        </p>
                                        <p className="text-sm text-blue-700">
                                            Verified Results: {results.filter(r => r.adminVerified).length} / {results.length}
                                        </p>
                                    </div>

                                    {!simulationData ? (
                                        <Button onClick={processQualification} disabled={results.filter(r => r.adminVerified).length === 0}>
                                            <Calculator className="h-4 w-4 mr-2" />
                                            Process Qualification
                                        </Button>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                                                <h3 className="font-semibold text-indigo-900 mb-2">Qualification Preview</h3>
                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div>
                                                        <p className="text-sm text-gray-600">Total Verified</p>
                                                        <p className="text-2xl font-bold">{simulationData.totalParticipants}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-gray-600">Will Qualify</p>
                                                        <p className="text-2xl font-bold text-green-600">{simulationData.qualifiedCount}</p>
                                                    </div>
                                                </div>

                                                <p className="font-medium text-sm">Qualified:</p>
                                                <div className="max-h-40 overflow-y-auto space-y-1 mt-2">
                                                    {simulationData.qualified.map((r, i) => (
                                                        <div key={r.id} className="flex items-center gap-2 p-2 bg-green-100 rounded">
                                                            <span className="font-bold text-green-700 w-6">{i + 1}</span>
                                                            <span className="flex-1">{r.userName}</span>
                                                            <span className="font-mono text-sm">{formatTime(r.average)}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {simulationData.eliminated.length > 0 && (
                                                    <>
                                                        <p className="font-medium text-sm mt-4">Not Qualified:</p>
                                                        <div className="max-h-40 overflow-y-auto space-y-1 mt-2">
                                                            {simulationData.eliminated.map((r, i) => (
                                                                <div key={r.id} className="flex items-center gap-2 p-2 bg-red-100 rounded">
                                                                    <span className="font-bold text-red-700 w-6">{simulationData.qualifiedCount + i + 1}</span>
                                                                    <span className="flex-1">{r.userName}</span>
                                                                    <span className="font-mono text-sm">{formatTime(r.average)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                <Button variant="outline" onClick={() => setSimulationData(null)}>Cancel</Button>
                                                <Button onClick={confirmQualification} disabled={processing}>
                                                    {processing ? 'Processing...' : 'Confirm Qualification'}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        <DialogHeader>
                            <DialogTitle>User Details</DialogTitle>
                            <DialogDescription>
                                {selectedUser?.userName || selectedUser?.displayName}
                            </DialogDescription>
                        </DialogHeader>

                        {selectedUser && (
                            <ScrollArea className="flex-1 overflow-auto">
                                <div className="space-y-6 p-4">
                                    <div className="flex items-start gap-6">
                                        <Avatar className="h-20 w-20">
                                            <AvatarImage src={selectedUser.photoURL || selectedUser.user?.photoURL} />
                                            <AvatarFallback className="text-xl">
                                                {(selectedUser.userName || selectedUser.displayName || 'U').charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 grid grid-cols-2 gap-4">
                                            <div>
                                                <Label className="text-gray-500">Name</Label>
                                                <p className="font-medium">{selectedUser.userName || selectedUser.displayName}</p>
                                            </div>
                                            <div>
                                                <Label className="text-gray-500">WCA ID</Label>
                                                <p className="font-mono">{selectedUser.wcaStyleId || selectedUser.wcaId || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <Label className="text-gray-500">Email</Label>
                                                <p className="text-sm">{selectedUser.email || selectedUser.userEmail}</p>
                                            </div>
                                            <div>
                                                <Label className="text-gray-500">IP Address</Label>
                                                <p className="font-mono text-sm">{selectedUser.userIp || selectedUser.ip || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-4 gap-4">
                                        <div className="p-3 bg-gray-50 rounded-lg">
                                            <Label className="text-gray-500 text-xs">Suspicion Score</Label>
                                            <p className="text-xl font-bold text-orange-600">{selectedUser.suspicionScore || selectedUser.anomalyScore || 0}</p>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-lg">
                                            <Label className="text-gray-500 text-xs">Focus Loss</Label>
                                            <p className="text-xl font-bold">{selectedUser.focusLossCount || 0}</p>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-lg">
                                            <Label className="text-gray-500 text-xs">Tab Switches</Label>
                                            <p className="text-xl font-bold">{selectedUser.tabSwitchCount || 0}</p>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-lg">
                                            <Label className="text-gray-500 text-xs">Flag Level</Label>
                                            <Badge variant={selectedUser.flagLevel === 'high' ? 'destructive' : selectedUser.flagLevel === 'medium' ? 'outline' : 'secondary'}>
                                                {selectedUser.flagLevel || 'None'}
                                            </Badge>
                                        </div>
                                    </div>

                                    {selectedUser.flagReason && (
                                        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                            <Label className="text-orange-700">Flag Reason</Label>
                                            <p className="text-orange-800">{selectedUser.flagReason}</p>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-semibold">Solves</h4>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" onClick={() => handleUserAction(selectedUser.userId, 'approve_all')}>
                                                    <CheckCircle className="h-4 w-4 mr-1" />
                                                    Approve All
                                                </Button>
                                                <Button variant="outline" size="sm" className="text-orange-600" onClick={() => {
                                                    const reason = prompt('Enter disqualification reason:');
                                                    if (reason) handleUserAction(selectedUser.userId, 'disqualify', reason);
                                                }}>
                                                    <XCircle className="h-4 w-4 mr-1" />
                                                    DQ
                                                </Button>
                                            </div>
                                        </div>

                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>#</TableHead>
                                                    <TableHead>Time</TableHead>
                                                    <TableHead>Penalty</TableHead>
                                                    <TableHead>Final</TableHead>
                                                    <TableHead>Score</TableHead>
                                                    <TableHead>Flag</TableHead>
                                                    <TableHead>Verified</TableHead>
                                                    <TableHead>Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {userSolves.map((solve, idx) => (
                                                    <TableRow key={solve.id} className={solve.flagged ? 'bg-orange-50' : ''}>
                                                        <TableCell>{idx + 1}</TableCell>
                                                        <TableCell className="font-mono">{formatTime(solve.time)}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={solve.penalty === 'DNF' ? 'destructive' : solve.penalty === '+2' ? 'outline' : 'secondary'}>
                                                                {solve.penalty || 'none'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="font-mono font-bold">{formatTime(solve.finalTime)}</TableCell>
                                                        <TableCell>{solve.anomalyScore || 0}</TableCell>
                                                        <TableCell>
                                                            {solve.flagged ? (
                                                                <Badge variant="destructive" className="text-xs">
                                                                    {solve.flagReason?.substring(0, 20) || 'Flagged'}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-gray-400">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {solve.adminVerified ? (
                                                                <CheckCircle className="h-4 w-4 text-green-600" />
                                                            ) : (
                                                                <XCircle className="h-4 w-4 text-gray-300" />
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex gap-1 flex-wrap">
                                                                <Button size="sm" variant="ghost" title="+2" onClick={() => handleSolveAction(solve.id, 'plus2', solve.time)}>+</Button>
                                                                <Button size="sm" variant="ghost" title="DNF" className="text-red-600" onClick={() => handleSolveAction(solve.id, 'dnf')}>DNF</Button>
                                                                <Button size="sm" variant="ghost" title="Verify" className={solve.adminVerified ? "text-green-600" : ""} onClick={() => handleSolveAction(solve.id, 'verify', !solve.adminVerified)}>
                                                                    <Check className="h-3 w-3" />
                                                                </Button>
                                                                {solve.flagged && (
                                                                    <Button size="sm" variant="ghost" title="Remove Flag" onClick={() => handleSolveAction(solve.id, 'remove_flag')}>
                                                                        <Flag className="h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                                <Button size="sm" variant="ghost" title="Override Time" onClick={() => {
                                                                    const newTime = prompt('Enter new time (seconds):');
                                                                    if (newTime) handleSolveAction(solve.id, 'override', newTime);
                                                                }}>
                                                                    <Clock className="h-3 w-3" />
                                                                </Button>
                                                                <Button size="sm" variant="ghost" title="Delete" className="text-red-600" onClick={() => {
                                                                    if (confirm('Delete this solve?')) handleSolveAction(solve.id, 'delete');
                                                                }}>
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </ScrollArea>
                        )}

                        <DialogFooter>
                            <div className="flex gap-2 w-full justify-between">
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => {
                                        if (!selectedUser?.userId) {
                                            alert('User not selected');
                                            return;
                                        }
                                        handleUserAction(selectedUser.userId, 'promote');
                                    }}>
                                        <ArrowUpCircle className="h-4 w-4 mr-2" />
                                        Promote to Next Round
                                    </Button>
                                    <Button variant="destructive" onClick={() => {
                                        if (confirm('Ban this user from all competitions?')) {
                                            handleUserAction(selectedUser?.userId, 'ban');
                                        }
                                    }}>
                                        <Ban className="h-4 w-4 mr-2" />
                                        Ban User
                                    </Button>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => {
                                        const note = prompt('Add internal note:');
                                        if (note) handleUserAction(selectedUser?.userId, 'note', note);
                                    }}>
                                        <Save className="h-4 w-4 mr-2" />
                                        Add Note
                                    </Button>
                                    <Button onClick={() => setShowUserModal(false)}>Close</Button>
                                </div>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}