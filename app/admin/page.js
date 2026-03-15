'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, limit, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, FileDown, Trophy, Users, DollarSign, Trash2, Ban, ShieldCheck, Shield, Clock, Timer, AlertTriangle, Eye, Gavel, CheckCircle, Plus, Tag, Percent, Layers, ChevronUp, ChevronDown, Settings2, Copy, Check, Video, Sword, Flag, XCircle } from 'lucide-react';
import { WCA_EVENTS, getEventName } from '@/lib/wcaEvents';
import {
    CompetitionMode,
    TournamentStatus,
    QualifyType,
    getDefaultRound,
    getDefaultTournamentSettings,
    formatRoundDate
} from '@/lib/tournament';

// Helper to format milliseconds to MM:SS display
function formatTimeInput(ms) {
    if (!ms || ms === 0) return { minutes: '0', seconds: '00' };
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return { minutes: minutes.toString(), seconds: seconds.toString().padStart(2, '0') };
}

// Helper to parse MM:SS to milliseconds
function parseTimeToMs(minutes, seconds) {
    const mins = parseInt(minutes) || 0;
    const secs = parseInt(seconds) || 0;
    return (mins * 60 + secs) * 1000;
}

// Default event settings
function getDefaultEventSettings(eventId) {
    return {
        format: 'Ao5',
        applyCutOff: false,
        cutOffTime: 120000, // 2:00 default
        cutOffAttempts: 2,
        applyMaxTime: false,
        maxTimeLimit: 600000 // 10:00 default
    };
}

export default function AdminPanel() {
    const { user, isAdmin, isSuperAdmin, isModerator, hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();

    // Data States
    const [competitions, setCompetitions] = useState([]);
    const [users, setUsers] = useState([]);
    const [payments, setPayments] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [flaggedSolves, setFlaggedSolves] = useState([]);
    const [coupons, setCoupons] = useState([]);
    const [couponUsages, setCouponUsages] = useState([]);
    const [battles, setBattles] = useState([]);
    const [battleReports, setBattleReports] = useState([]);
    const [bannedUsers, setBannedUsers] = useState([]);
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalRevenue: 0,
        activeCompetitions: 0
    });
    const [loadingData, setLoadingData] = useState(true);
    const [battleFilter, setBattleFilter] = useState('all');
    const [reportFilter, setReportFilter] = useState('pending');
    const [selectedReport, setSelectedReport] = useState(null);
    const [reportActionLoading, setReportActionLoading] = useState(null);

    // Form States
    const [editingComp, setEditingComp] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        registrationStartDate: '',
        registrationEndDate: '',
        type: 'FREE',
        currency: 'INR',
        pricingModel: 'flat',
        flatPrice: 0,
        basePrice: 0,
        perEventPrice: 0,
        solveLimit: 5,
        selectedEvents: [],
        eventSettings: {},
        scrambles: {},
        isPublished: false,
        mode: CompetitionMode.STANDARD,
        rounds: [getDefaultRound(1, false)],
        currentRound: 1,
        tournamentStatus: TournamentStatus.REGISTRATION,
        videoRequired: false,
        videoRequiredFromRound: 1,
        verificationMandatory: false,
        verificationRequiredFromRound: 1
    });

    const [couponForm, setCouponForm] = useState({
        code: '',
        type: 'flat',
        value: 0,
        usageLimitTotal: 100,
        usageLimitPerUser: 1,
        expiresAt: '',
        active: true,
        applicableCompetitionIds: [],
        newUsersOnly: false
    });
    const [editingCoupon, setEditingCoupon] = useState(null);

    // Scramble copy state
    const [copiedScramble, setCopiedScramble] = useState(null);

    // Auth Protection
    useEffect(() => {
        if (!authLoading) {
            if (!user) router.push('/auth/login');
            else if (!isAdmin) router.push('/');
        }
    }, [user, isAdmin, authLoading, router]);

    // Fetch Data
    useEffect(() => {
        if (user && isAdmin) fetchData();
    }, [user, isAdmin]);

    async function fetchData() {
        setLoadingData(true);
        try {
            const compsSnap = await getDocs(collection(db, 'competitions'));
            const compsData = compsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            compsData.sort((a, b) => new Date(b.startDate || b.createdAt) - new Date(a.startDate || a.createdAt));
            setCompetitions(compsData);

            const usersSnap = await getDocs(collection(db, 'users'));
            const usersData = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(usersData);

            const paymentsSnap = await getDocs(collection(db, 'payments'));
            const paymentsData = paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            paymentsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setPayments(paymentsData);

            const auditQuery = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(50));
            const auditSnap = await getDocs(auditQuery);
            setAuditLogs(auditSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            // Fetch Flagged Solves from top-level 'solves' collection
            const flaggedQuery = query(collection(db, 'solves'), where('flagged', '==', true));
            const flaggedSnap = await getDocs(flaggedQuery);
            const compMap = new Map(compsData.map(c => [c.id, c.name]));
            const flaggedResults = flaggedSnap.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                    competitionName: compMap.get(data.competitionId) || 'Unknown Competition'
                };
            });
            flaggedResults.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setFlaggedSolves(flaggedResults);

            // Fetch Battles
            const battlesQuery = query(collection(db, 'battles'), orderBy('createdAt', 'desc'), limit(50));
            const battlesSnap = await getDocs(battlesQuery);
            setBattles(battlesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            // Fetch Battle Reports
            try {
                const reportsRes = await fetch('/api/battle/report?status=all');
                const reportsData = await reportsRes.json();
                if (reportsData.reports) setBattleReports(reportsData.reports);
            } catch (e) {
                console.error('Failed to fetch reports:', e);
            }

            // Fetch Banned Users
            try {
                const bansRes = await fetch('/api/admin/ban?active=true');
                if (!bansRes.ok) {
                    console.error('Failed to fetch bans: HTTP', bansRes.status, bansRes.statusText);
                } else {
                    const bansData = await bansRes.json();
                    if (bansData.bans) setBannedUsers(bansData.bans);
                }
            } catch (e) {
                console.error('Failed to fetch bans:', e);
            }

            const couponsSnap = await getDocs(collection(db, 'coupons'));
            const couponsData = couponsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            couponsData.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return dateB - dateA;
            });
            setCoupons(couponsData);

            const usageSnap = await getDocs(collection(db, 'couponUsages'));
            setCouponUsages(usageSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            const totalRevenue = paymentsData
                .filter(p => p.status === 'SUCCESS')
                .reduce((sum, p) => {
                    const amount = parseFloat(p.finalAmount || p.amount) || 0;
                    return sum + (p.currency === 'USD' ? amount * 90 : amount);
                }, 0);

            const now = new Date();
            const activeComps = compsData.filter(c => {
                const end = c.endDate ? new Date(c.endDate) : new Date();
                return end > now;
            }).length;

            setStats({
                totalUsers: usersData.length,
                totalRevenue,
                activeCompetitions: activeComps
            });

        } catch (error) {
            console.error('Error fetching admin data:', error);
            if (error.code === 'permission-denied' || error.message.includes('permission')) {
                alert("Access Denied: Your user account in Firestore does not have the 'role: admin' field required by security rules.");
            } else {
                alert("Error loading admin data: " + error.message);
            }
        } finally {
            setLoadingData(false);
        }
    }

    const handleToggleUserStatus = async (userId, currentStatus) => {
        const newStatus = currentStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
        if (!confirm(`Are you sure you want to change user status to ${newStatus}?`)) return;

        try {
            await updateDoc(doc(db, 'users', userId), { status: newStatus });
            setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
            alert(`User ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'}`);
        } catch (error) {
            alert('Error updating user: ' + error.message);
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!confirm('Are you sure? This action cannot be undone.')) return;
        try {
            await deleteDoc(doc(db, 'users', userId));
            setUsers(users.filter(u => u.id !== userId));
            setStats(prev => ({ ...prev, totalUsers: prev.totalUsers - 1 }));
            alert('User deleted');
        } catch (error) {
            alert('Error deleting user: ' + error.message);
        }
    };

    const handleDeleteCompetition = async (competitionId, competitionName) => {
        if (!confirm(`Are you sure you want to delete "${competitionName}"? This will also delete all related data (registrations, results, solves). This action cannot be undone.`)) return;

        try {
            setLoadingData(true);

            // Delete related data
            const collectionsToClean = ['registrations', 'results', 'solves', 'roundResults', 'tournamentParticipants', 'videoSubmissions', 'scrambleReveals'];

            for (const collectionName of collectionsToClean) {
                const snapshot = await getDocs(query(collection(db, collectionName), where('competitionId', '==', competitionId)));
                const batch = writeBatch(db);
                snapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            }

            // Delete the competition
            await deleteDoc(doc(db, 'competitions', competitionId));

            // Update local state
            setCompetitions(competitions.filter(c => c.id !== competitionId));
            alert('Competition deleted successfully');
        } catch (error) {
            console.error('Error deleting competition:', error);
            if (error.message.includes('permission')) {
                alert('Error: Only SUPER_ADMIN can delete competitions. Your current role does not have permission.');
            } else {
                alert('Error deleting competition: ' + error.message);
            }
        } finally {
            setLoadingData(false);
        }
    };

    const handleResolveFlag = async (solve, action) => {
        if (!confirm(`Are you sure you want to ${action} this solve?`)) return;

        try {
            const solveRef = doc(db, 'solves', solve.id);

            if (action === 'approve') {
                await updateDoc(solveRef, {
                    flagged: false,
                    flagResolved: true,
                    flagResolution: 'Approved by Admin',
                    resolvedAt: new Date().toISOString(),
                    resolvedBy: user.email
                });
            } else if (action === 'dnf') {
                await updateDoc(solveRef, {
                    time: null,
                    finalTime: null,
                    penalty: 'DNF',
                    flagged: false,
                    flagResolved: true,
                    flagResolution: 'DNF by Admin',
                    resolvedAt: new Date().toISOString(),
                    resolvedBy: user.email
                });
            } else if (action === 'plus2') {
                const originalTime = solve.time || 0;
                const newFinalTime = originalTime + 2000;
                await updateDoc(solveRef, {
                    finalTime: newFinalTime,
                    penalty: '+2',
                    flagged: false,
                    flagResolved: true,
                    flagResolution: '+2 Penalty by Admin',
                    resolvedAt: new Date().toISOString(),
                    resolvedBy: user.email
                });
            } else if (action === 'delete') {
                await deleteDoc(solveRef);
            }

            await addDoc(collection(db, 'auditLogs'), {
                action: `SOLVE_${action.toUpperCase()}`,
                adminId: user.uid,
                adminEmail: user.email,
                solveId: solve.id,
                userEmail: solve.userEmail,
                competitionId: solve.competitionId,
                eventId: solve.eventId,
                attemptNumber: solve.attemptNumber,
                timestamp: new Date().toISOString()
            });

            alert('Action completed');
            fetchData();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleExportFlags = () => {
        if (!flaggedSolves.length) return alert('No flagged solves to export');

        const headers = ['ID', 'User', 'Email', 'Competition', 'Event', 'Attempt', 'Time(ms)', 'Penalty', 'Flag Reason', 'Violations', 'IP', 'Country', 'City', 'Anomaly Score', 'Date'];
        const rows = flaggedSolves.map(s => [
            s.id,
            s.userName || 'Unknown',
            s.userEmail || 'N/A',
            s.competitionName,
            getEventName(s.eventId),
            s.attemptNumber || 'N/A',
            s.time || 'DNF',
            s.penalty || 'none',
            s.flagReason || 'Flagged',
            [
                s.visibilityViolation ? 'TabSwitch' : '',
                s.windowBlurViolation ? 'WindowBlur' : '',
                s.multiTabViolation ? 'MultiTab' : '',
                s.rightClickViolation ? 'RightClick' : '',
                s.devToolsViolation ? 'DevTools' : '',
                s.suspiciousTimeViolation ? 'SuspiciousTime' : '',
                s.pageRefreshViolation ? 'PageRefresh' : ''
            ].filter(Boolean).join('; '),
            s.userIp || 'N/A',
            s.ipCountry || 'N/A',
            s.ipCity || 'N/A',
            s.anomalyScore || 0,
            new Date(s.createdAt).toLocaleString()
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `flagged_solves_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getCompetitionName = (compId) => {
        const comp = competitions.find(c => c.id === compId);
        return comp ? comp.name : 'Unknown Competition';
    };

    const handleEventToggle = (eventId) => {
        setFormData(prev => {
            const current = prev.selectedEvents;
            const updated = current.includes(eventId)
                ? current.filter(id => id !== eventId)
                : [...current, eventId];
            return { ...prev, selectedEvents: updated };
        });
    };

    const handleEventSettingChange = (eventId, setting, value) => {
        setFormData(prev => {
            const currentSettings = prev.eventSettings[eventId] || getDefaultEventSettings(eventId);
            return {
                ...prev,
                eventSettings: {
                    ...prev.eventSettings,
                    [eventId]: { ...currentSettings, [setting]: value }
                }
            };
        });
    };

    const handleScrambleChange = (eventId, index, value) => {
        setFormData(prev => {
            const currentScrambles = prev.scrambles[eventId] || {};
            return {
                ...prev,
                scrambles: {
                    ...prev.scrambles,
                    [eventId]: { ...currentScrambles, [index]: value }
                }
            };
        });
    };

    const handleRoundScrambleChange = (eventId, roundNumber, index, value) => {
        setFormData(prev => {
            const currentEventScrambles = prev.scrambles[eventId] || {};
            const currentRoundScrambles = currentEventScrambles[roundNumber] || {};
            return {
                ...prev,
                scrambles: {
                    ...prev.scrambles,
                    [eventId]: {
                        ...currentEventScrambles,
                        [roundNumber]: { ...currentRoundScrambles, [index]: value }
                    }
                }
            };
        });
    };

    // Copy scramble to clipboard
    const copyScrambleToClipboard = (scramble, id) => {
        navigator.clipboard.writeText(scramble).then(() => {
            setCopiedScramble(id);
            setTimeout(() => setCopiedScramble(null), 2000);
        });
    };

    // Copy all scrambles for an event
    const copyAllScramblesForEvent = (eventId, roundNumber = null) => {
        let scramblesText = '';

        if (formData.mode === CompetitionMode.TOURNAMENT && roundNumber) {
            const roundScrambles = formData.scrambles[eventId]?.[roundNumber];
            if (roundScrambles) {
                scramblesText = Object.entries(roundScrambles)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([idx, scramble]) => `Attempt ${parseInt(idx) + 1}: ${scramble}`)
                    .join('\n');
            }
        } else {
            const eventScrambles = formData.scrambles[eventId];
            if (eventScrambles) {
                scramblesText = Object.entries(eventScrambles)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([idx, scramble]) => `Attempt ${parseInt(idx) + 1}: ${scramble}`)
                    .join('\n');
            }
        }

        if (scramblesText) {
            navigator.clipboard.writeText(scramblesText).then(() => {
                alert(`Copied all scrambles for ${getEventName(eventId)} to clipboard!`);
            });
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            startDate: '',
            endDate: '',
            registrationStartDate: '',
            registrationEndDate: '',
            type: 'FREE',
            currency: 'INR',
            pricingModel: 'flat',
            flatPrice: 0,
            basePrice: 0,
            perEventPrice: 0,
            solveLimit: 5,
            selectedEvents: [],
            eventSettings: {},
            scrambles: {},
            isPublished: false,
            mode: CompetitionMode.STANDARD,
            rounds: [getDefaultRound(1, false)],
            currentRound: 1,
            tournamentStatus: TournamentStatus.REGISTRATION
        });
        setEditingComp(null);
    };

    const loadCompForEdit = (comp) => {
        setEditingComp(comp);
        setFormData({
            name: comp.name || '',
            description: comp.description || '',
            startDate: comp.startDate || '',
            endDate: comp.endDate || '',
            registrationStartDate: comp.registrationStartDate || '',
            registrationEndDate: comp.registrationEndDate || '',
            type: comp.type || 'FREE',
            currency: comp.currency || 'INR',
            pricingModel: comp.pricingModel || 'flat',
            flatPrice: comp.flatPrice || 0,
            basePrice: comp.basePrice || 0,
            perEventPrice: comp.perEventPrice || 0,
            solveLimit: comp.solveLimit || 5,
            selectedEvents: comp.events || [],
            eventSettings: comp.eventSettings || {},
            scrambles: comp.scrambles || {},
            isPublished: comp.isPublished || false,
            mode: comp.mode || CompetitionMode.STANDARD,
            rounds: comp.rounds || [getDefaultRound(1, false)],
            currentRound: comp.currentRound || 1,
            tournamentStatus: comp.tournamentStatus || TournamentStatus.REGISTRATION,
            videoRequired: comp.videoRequired || false,
            videoRequiredFromRound: comp.videoRequiredFromRound || 1,
            verificationMandatory: comp.verificationMandatory || false,
            verificationRequiredFromRound: comp.verificationRequiredFromRound || 1
        });
    };

    const handleCompSubmit = async (e) => {
        e.preventDefault();
        if (formData.selectedEvents.length === 0) {
            alert('Please select at least one event');
            return;
        }

        if (formData.mode === CompetitionMode.TOURNAMENT && (!formData.rounds || formData.rounds.length === 0)) {
            alert('Tournament mode requires at least one round');
            return;
        }

        try {
            const compData = {
                name: formData.name,
                description: formData.description,
                startDate: formData.startDate,
                endDate: formData.endDate,
                registrationStartDate: formData.registrationStartDate,
                registrationEndDate: formData.registrationEndDate,
                type: formData.type,
                currency: formData.currency,
                pricingModel: formData.pricingModel,
                flatPrice: parseFloat(formData.flatPrice),
                basePrice: parseFloat(formData.basePrice),
                perEventPrice: parseFloat(formData.perEventPrice),
                solveLimit: parseInt(formData.solveLimit),
                events: formData.selectedEvents,
                eventSettings: formData.eventSettings,
                scrambles: formData.scrambles,
                isPublished: formData.isPublished,
                mode: formData.mode,
                videoRequired: formData.videoRequired || false,
                videoRequiredFromRound: formData.videoRequiredFromRound || 1,
                verificationMandatory: formData.verificationMandatory || false,
                verificationRequiredFromRound: formData.verificationRequiredFromRound || 1,
                updatedAt: new Date().toISOString()
            };

            if (formData.mode === CompetitionMode.TOURNAMENT) {
                compData.rounds = formData.rounds;
                compData.currentRound = formData.currentRound || 1;
                compData.tournamentStatus = formData.tournamentStatus || TournamentStatus.REGISTRATION;
                compData.winners = editingComp?.winners || [];
            }

            if (editingComp) {
                await updateDoc(doc(db, 'competitions', editingComp.id), compData);
                alert('Competition updated successfully');
            } else {
                compData.createdAt = new Date().toISOString();
                compData.status = 'upcoming';
                await addDoc(collection(db, 'competitions'), compData);
                alert('Competition created successfully');
            }

            resetForm();
            fetchData();
        } catch (error) {
            console.error('Error saving competition:', error);
            alert('Error saving competition: ' + error.message);
        }
    };

    const handleExportPayments = () => {
        if (!payments.length) return alert('No payments to export');

        const headers = ['Date', 'Competition', 'User', 'Original Amount', 'Discount', 'Final Amount', 'Currency', 'Coupon Code', 'Status'];
        const rows = payments.map(p => [
            new Date(p.createdAt).toLocaleDateString(),
            getCompetitionName(p.competitionId),
            p.userEmail,
            p.originalAmount || p.amount || 0,
            p.discountAmount || 0,
            p.finalAmount || p.amount || 0,
            p.currency,
            p.couponCode || '',
            p.status
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `payments_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportCouponUsages = () => {
        if (!couponUsages.length) return alert('No coupon usage data to export');

        const headers = ['Date', 'Coupon Code', 'User Email', 'Competition', 'Original Amount', 'Discount', 'Final Amount'];
        const rows = couponUsages.map(u => [
            u.usedAt ? new Date(u.usedAt.toDate ? u.usedAt.toDate() : u.usedAt).toLocaleString() : 'N/A',
            u.couponCode || 'N/A',
            u.userId || 'N/A',
            getCompetitionName(u.competitionId),
            u.originalAmount || 0,
            u.discountAmount || 0,
            u.finalAmount || 0
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `coupon_usage_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const resetCouponForm = () => {
        setCouponForm({
            code: '',
            type: 'flat',
            value: 0,
            usageLimitTotal: 100,
            usageLimitPerUser: 1,
            expiresAt: '',
            active: true,
            applicableCompetitionIds: [],
            newUsersOnly: false
        });
        setEditingCoupon(null);
    };

    const handleCouponSubmit = async (e) => {
        e.preventDefault();

        if (!couponForm.code.trim()) {
            alert('Please enter a coupon code');
            return;
        }

        try {
            const couponData = {
                code: couponForm.code.toUpperCase().trim(),
                type: couponForm.type,
                value: parseFloat(couponForm.value) || 0,
                usageLimitTotal: parseInt(couponForm.usageLimitTotal) || 100,
                usageLimitPerUser: parseInt(couponForm.usageLimitPerUser) || 1,
                active: couponForm.active,
                newUsersOnly: couponForm.newUsersOnly || false,
                applicableCompetitionIds: couponForm.applicableCompetitionIds || [],
                updatedAt: new Date().toISOString()
            };

            if (couponForm.expiresAt) {
                couponData.expiresAt = new Date(couponForm.expiresAt);
            }

            if (editingCoupon) {
                await updateDoc(doc(db, 'coupons', editingCoupon.id), couponData);
                alert('Coupon updated successfully');
            } else {
                const existingCoupon = coupons.find(c => c.code === couponData.code);
                if (existingCoupon) {
                    alert('A coupon with this code already exists');
                    return;
                }
                couponData.createdAt = new Date().toISOString();
                couponData.usedCount = 0;
                couponData.createdBy = user.uid;
                await addDoc(collection(db, 'coupons'), couponData);
                alert('Coupon created successfully');
            }

            resetCouponForm();
            fetchData();
        } catch (error) {
            console.error('Error saving coupon:', error);
            alert('Error saving coupon: ' + error.message);
        }
    };

    const handleToggleCouponStatus = async (couponId, currentStatus) => {
        try {
            await updateDoc(doc(db, 'coupons', couponId), {
                active: !currentStatus,
                updatedAt: new Date().toISOString()
            });
            alert(`Coupon ${!currentStatus ? 'activated' : 'deactivated'}`);
            fetchData();
        } catch (error) {
            alert('Error updating coupon: ' + error.message);
        }
    };

    const handleDeleteCoupon = async (couponId) => {
        if (!confirm('Are you sure you want to delete this coupon? This action cannot be undone.')) return;

        try {
            await deleteDoc(doc(db, 'coupons', couponId));
            alert('Coupon deleted');
            fetchData();
        } catch (error) {
            alert('Error deleting coupon: ' + error.message);
        }
    };

    const loadCouponForEdit = (coupon) => {
        setEditingCoupon(coupon);
        setCouponForm({
            code: coupon.code || '',
            type: coupon.type || 'flat',
            value: coupon.value || 0,
            usageLimitTotal: coupon.usageLimitTotal || 100,
            usageLimitPerUser: coupon.usageLimitPerUser || 1,
            expiresAt: coupon.expiresAt ?
                (coupon.expiresAt.toDate ? coupon.expiresAt.toDate() : new Date(coupon.expiresAt))
                    .toISOString().slice(0, 16) : '',
            active: coupon.active ?? true,
            applicableCompetitionIds: coupon.applicableCompetitionIds || [],
            newUsersOnly: coupon.newUsersOnly || false
        });
    };

    if (authLoading || loadingData) return <div className="p-8 text-center">Loading Admin Panel...</div>;
    if (!isAdmin) return null;

    return (
        <div className="container mx-auto p-6 space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                <Button variant="outline" onClick={fetchData}><RefreshCw className="w-4 h-4 mr-2" /> Refresh Data</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{stats.totalRevenue.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalUsers}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Competitions</CardTitle>
                        <Trophy className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeCompetitions}</div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="competitions" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="competitions">Competitions</TabsTrigger>
                    <TabsTrigger value="results">
                        <Trophy className="w-4 h-4 mr-2" />
                        Results
                    </TabsTrigger>
                    <TabsTrigger value="users">Users</TabsTrigger>
                    <TabsTrigger value="security" className="text-orange-600 data-[state=active]:text-orange-700">
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Security & Anti-Cheat
                        {flaggedSolves.length > 0 && (
                            <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                                {flaggedSolves.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="battles">
                        <Sword className="w-4 h-4 mr-2" />
                        Battles
                        {(battleReports.filter(r => r.status === 'pending').length > 0) && (
                            <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                                {battleReports.filter(r => r.status === 'pending').length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="payments">Payments</TabsTrigger>
                    {isSuperAdmin && (
                        <TabsTrigger value="verification" className="text-purple-600 data-[state=active]:text-purple-700">
                            <ShieldCheck className="w-4 h-4 mr-2" />
                            Verification
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="coupons">
                        <Tag className="w-4 h-4 mr-2" />
                        Coupons
                    </TabsTrigger>
                    <TabsTrigger value="audit">Audit Logs</TabsTrigger>
                </TabsList>

                <TabsContent value="security">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-red-600 flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5" />
                                    Flagged Solves Review
                                </CardTitle>
                                <p className="text-sm text-gray-500 mt-1">
                                    Solves flagged by the anti-cheat system for suspicious activity.
                                </p>
                            </div>
                            <Button variant="outline" onClick={handleExportFlags}>
                                <FileDown className="mr-2 h-4 w-4" />
                                Export CSV
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {flaggedSolves.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <ShieldCheck className="h-12 w-12 mx-auto mb-4 text-green-500" />
                                    <p>No flagged solves found. System is clean.</p>
                                </div>
                            ) : (
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>User / Comp</TableHead>
                                                <TableHead>Event / Time</TableHead>
                                                <TableHead>Violation Details</TableHead>
                                                <TableHead>Tech Info</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {flaggedSolves.map(solve => (
                                                <TableRow key={solve.id}>
                                                    <TableCell>
                                                        <div className="font-medium">{solve.userName || 'Unknown'}</div>
                                                        <div className="text-xs text-gray-500">{solve.userEmail}</div>
                                                        <div className="text-xs font-semibold mt-1 text-blue-600">{solve.competitionName}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-bold">{getEventName(solve.eventId)}</div>
                                                        <div className="font-mono text-lg text-orange-600">
                                                            {solve.penalty === 'DNF' ? 'DNF' : solve.time ? (solve.time / 1000).toFixed(2) + 's' : 'N/A'}
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            Attempt #{solve.attemptNumber} • {new Date(solve.createdAt).toLocaleDateString()}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="max-w-[250px]">
                                                        <div className="space-y-1">
                                                            <Badge variant="destructive" className="mb-1">{solve.flagReason || 'Flagged'}</Badge>
                                                            <div className="text-xs grid grid-cols-2 gap-1">
                                                                {solve.visibilityViolation && <span className="text-red-500">• Tab Switch</span>}
                                                                {solve.windowBlurViolation && <span className="text-red-500">• Window Blur</span>}
                                                                {solve.multiTabViolation && <span className="text-red-500">• Multi-Tab</span>}
                                                                {solve.rightClickViolation && <span className="text-red-500">• Right Click</span>}
                                                                {solve.devToolsViolation && <span className="text-red-500">• DevTools</span>}
                                                                {solve.suspiciousTimeViolation && <span className="text-red-500">• Suspicious Time</span>}
                                                                {solve.pageRefreshViolation && <span className="text-red-500">• Page Refresh</span>}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-xs space-y-1">
                                                            <div><span className="font-semibold">IP:</span> {solve.userIp || 'N/A'}</div>
                                                            <div><span className="font-semibold">Loc:</span> {solve.ipCity || solve.city}, {solve.ipCountry || solve.country}</div>
                                                            {solve.anomalyScore > 0 && (
                                                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                                                    Score: {solve.anomalyScore}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-green-600 hover:bg-green-50 border-green-200"
                                                                onClick={() => handleResolveFlag(solve, 'approve')}
                                                                title="Approve (Clear Flag)"
                                                            >
                                                                <CheckCircle className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-blue-600 hover:bg-blue-50 border-blue-200"
                                                                onClick={() => handleResolveFlag(solve, 'plus2')}
                                                                title="+2 Penalty"
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-orange-600 hover:bg-orange-50 border-orange-200"
                                                                onClick={() => handleResolveFlag(solve, 'dnf')}
                                                                title="DNF"
                                                            >
                                                                DNF
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={() => handleResolveFlag(solve, 'delete')}
                                                                title="Delete Solve"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="results" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-indigo-600" />
                                Results Management
                            </CardTitle>
                            <CardDescription>Manage competition results, verification, and qualifications</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Competition</TableHead>
                                            <TableHead>Mode</TableHead>
                                            <TableHead>Rounds</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {competitions.filter(c => c.isPublished).map(comp => (
                                            <TableRow key={comp.id}>
                                                <TableCell className="font-medium">{comp.name}</TableCell>
                                                <TableCell>
                                                    {comp.mode === CompetitionMode.TOURNAMENT ? (
                                                        <Badge className="bg-indigo-100 text-indigo-700">
                                                            <Layers className="h-3 w-3 mr-1" />
                                                            Tournament
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline">Standard</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>{comp.rounds?.length || 1} rounds</TableCell>
                                                <TableCell>
                                                    {comp.tournamentStatus === TournamentStatus.COMPLETED ? (
                                                        <Badge className="bg-green-100 text-green-700">Completed</Badge>
                                                    ) : comp.tournamentStatus === TournamentStatus.ROUND_LIVE ? (
                                                        <Badge className="bg-blue-100 text-blue-700">Live</Badge>
                                                    ) : (
                                                        <Badge variant="outline">{comp.tournamentStatus || 'Registration'}</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => router.push(`/admin/results/${comp.id}`)}
                                                    >
                                                        <Trophy className="h-4 w-4 mr-2" />
                                                        Manage Results
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {competitions.filter(c => c.isPublished).length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                                    No published competitions found
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="competitions" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>{editingComp ? 'Edit Competition' : 'Create New Competition'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCompSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2 col-span-2">
                                        <Label>Competition Name</Label>
                                        <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                                    </div>

                                    <div className="space-y-2 col-span-2">
                                        <Label>Description</Label>
                                        <Textarea 
                                            value={formData.description} 
                                            onChange={e => setFormData({ ...formData, description: e.target.value })} 
                                            placeholder="Enter competition description (optional)"
                                            rows={3}
                                        />
                                    </div>

                                    <div className="space-y-4 border p-4 rounded-md bg-blue-50/50">
                                        <h3 className="font-semibold text-blue-900">Competition Period (When users can solve)</h3>
                                        <div className="space-y-2">
                                            <Label>Start Date & Time</Label>
                                            <Input type="datetime-local" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>End Date & Time</Label>
                                            <Input type="datetime-local" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} required />
                                        </div>
                                    </div>

                                    <div className="space-y-4 border p-4 rounded-md bg-green-50/50">
                                        <h3 className="font-semibold text-green-900">Registration Period (When users can signup)</h3>
                                        <div className="space-y-2">
                                            <Label>Registration Opens</Label>
                                            <Input type="datetime-local" value={formData.registrationStartDate} onChange={e => setFormData({ ...formData, registrationStartDate: e.target.value })} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Registration Closes</Label>
                                            <Input type="datetime-local" value={formData.registrationEndDate} onChange={e => setFormData({ ...formData, registrationEndDate: e.target.value })} required />
                                        </div>
                                    </div>
                                </div>

                                {/* PRICING SECTION */}
                                <div className="space-y-4 border p-4 rounded-md bg-slate-50 dark:bg-slate-900">
                                    <h3 className="font-semibold">Pricing Configuration</h3>

                                    <div className="flex gap-6">
                                        <div className="space-y-2">
                                            <Label>Type</Label>
                                            <RadioGroup
                                                value={formData.type}
                                                onValueChange={val => setFormData({ ...formData, type: val })}
                                                className="flex gap-4"
                                            >
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="FREE" id="type-free" />
                                                    <Label htmlFor="type-free">Free</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="PAID" id="type-paid" />
                                                    <Label htmlFor="type-paid">Paid</Label>
                                                </div>
                                            </RadioGroup>
                                        </div>

                                        {formData.type === 'PAID' && (
                                            <div className="space-y-2">
                                                <Label>Currency</Label>
                                                <Select value={formData.currency} onValueChange={val => setFormData({ ...formData, currency: val })}>
                                                    <SelectTrigger className="w-[100px]">
                                                        <SelectValue placeholder="Currency" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="INR">INR (₹)</SelectItem>
                                                        <SelectItem value="USD">USD ($)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </div>

                                    {formData.type === 'PAID' && (
                                        <div className="space-y-4 animate-in fade-in">
                                            <div className="space-y-2">
                                                <Label>Flat Registration Fee</Label>
                                                <Input type="number" value={formData.flatPrice} onChange={e => setFormData({ ...formData, flatPrice: e.target.value })} required />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>Solve Limit (AoX)</Label>
                                    <Input type="number" value={formData.solveLimit} onChange={e => setFormData({ ...formData, solveLimit: e.target.value })} required />
                                </div>

                                {/* TOURNAMENT MODE CONFIGURATION */}
                                <div className="space-y-4 border p-4 rounded-md bg-indigo-50/50 dark:bg-indigo-950/20">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Layers className="h-5 w-5 text-indigo-500" />
                                            <Label className="text-lg font-semibold text-indigo-900 dark:text-indigo-100">Competition Mode</Label>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="radio"
                                                    id="mode-standard"
                                                    name="mode"
                                                    value={CompetitionMode.STANDARD}
                                                    checked={formData.mode === CompetitionMode.STANDARD}
                                                    onChange={() => setFormData({
                                                        ...formData,
                                                        mode: CompetitionMode.STANDARD,
                                                        rounds: [getDefaultRound(1, false)]
                                                    })}
                                                    className="h-4 w-4"
                                                />
                                                <Label htmlFor="mode-standard" className="font-normal">Standard</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="radio"
                                                    id="mode-tournament"
                                                    name="mode"
                                                    value={CompetitionMode.TOURNAMENT}
                                                    checked={formData.mode === CompetitionMode.TOURNAMENT}
                                                    onChange={() => setFormData({
                                                        ...formData,
                                                        mode: CompetitionMode.TOURNAMENT,
                                                        rounds: [
                                                            getDefaultRound(1, false),
                                                            { ...getDefaultRound(2, false), qualifyType: QualifyType.PERCENTAGE, qualifyValue: 50 },
                                                            { ...getDefaultRound(3, true), qualifyType: QualifyType.FIXED, qualifyValue: 3 }
                                                        ]
                                                    })}
                                                    className="h-4 w-4"
                                                />
                                                <Label htmlFor="mode-tournament" className="font-normal">Tournament (Multi-Round)</Label>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {formData.mode === CompetitionMode.STANDARD
                                            ? 'Standard competition: All participants compete in a single round.'
                                            : 'Tournament mode: Multiple rounds with qualification cuts. Admin controls advancement.'}
                                    </p>

                                    {/* Video Requirement Settings */}
                                    <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                                        <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-3 flex items-center gap-2">
                                            <Video className="h-4 w-4" />
                                            Video Verification Settings
                                        </h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="videoRequired"
                                                    checked={formData.videoRequired || false}
                                                    onCheckedChange={(checked) => setFormData({ ...formData, videoRequired: checked })}
                                                />
                                                <Label htmlFor="videoRequired" className="text-sm">
                                                    Require video submission for verification
                                                </Label>
                                            </div>

                                            {formData.videoRequired && (
                                                <div className="ml-6 space-y-2">
                                                    <Label className="text-sm text-gray-600">Require video from round:</Label>
                                                    <Select
                                                        value={formData.videoRequiredFromRound?.toString() || '1'}
                                                        onValueChange={(v) => setFormData({ ...formData, videoRequiredFromRound: parseInt(v) })}
                                                    >
                                                        <SelectTrigger className="w-[180px]">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="1">Round 1</SelectItem>
                                                            <SelectItem value="2">Round 2</SelectItem>
                                                            <SelectItem value="3">Round 3</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <p className="text-xs text-gray-500">
                                                        Video will be required starting from this round
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Identity Verification Settings */}
                                    <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                                        <h3 className="font-semibold text-indigo-900 dark:text-indigo-200 mb-3 flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4" />
                                            Identity Verification (DIDIT)
                                        </h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="verificationMandatory"
                                                    checked={formData.verificationMandatory || false}
                                                    onCheckedChange={(checked) => setFormData({ ...formData, verificationMandatory: checked })}
                                                />
                                                <Label htmlFor="verificationMandatory" className="text-sm">
                                                    Require identity verification to participate
                                                </Label>
                                            </div>

                                            {formData.verificationMandatory && (
                                                <div className="ml-6 space-y-2">
                                                    <Label className="text-sm text-gray-600">Require verification from round:</Label>
                                                    <Select
                                                        value={formData.verificationRequiredFromRound?.toString() || '1'}
                                                        onValueChange={(v) => setFormData({ ...formData, verificationRequiredFromRound: parseInt(v) })}
                                                    >
                                                        <SelectTrigger className="w-[180px]">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="1">Round 1</SelectItem>
                                                            <SelectItem value="2">Round 2</SelectItem>
                                                            <SelectItem value="3">Round 3</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <p className="text-xs text-gray-500">
                                                        Identity verification will be required starting from this round. Round 1 can remain open if configured.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {formData.mode === CompetitionMode.TOURNAMENT && (
                                        <div className="space-y-4 mt-4 animate-in fade-in">
                                            <div className="flex items-center justify-between mb-2">
                                                <Label className="font-semibold text-indigo-800 dark:text-indigo-200">Round Configuration</Label>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        const newRoundNumber = formData.rounds.length + 1;
                                                        const isFinal = window.confirm('Should this be the final round?');
                                                        setFormData({
                                                            ...formData,
                                                            rounds: [...formData.rounds, getDefaultRound(newRoundNumber, isFinal)]
                                                        });
                                                    }}
                                                    className="text-indigo-600 border-indigo-300 hover:bg-indigo-50"
                                                >
                                                    <Plus className="h-4 w-4 mr-1" /> Add Round
                                                </Button>
                                            </div>

                                            {formData.rounds.map((round, index) => (
                                                <Card key={index} className="bg-white dark:bg-gray-800 border-indigo-200 dark:border-indigo-800">
                                                    <CardHeader className="py-3 flex flex-row items-center justify-between">
                                                        <CardTitle className="text-base flex items-center gap-2">
                                                            <Settings2 className="h-4 w-4 text-indigo-500" />
                                                            {round.name || `Round ${round.roundNumber}`}
                                                            {round.isFinal && <Badge className="bg-yellow-500 text-white ml-2">Final</Badge>}
                                                        </CardTitle>
                                                        {formData.rounds.length > 1 && (
                                                            <div className="flex gap-1">
                                                                {index > 0 && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            const newRounds = [...formData.rounds];
                                                                            [newRounds[index - 1], newRounds[index]] = [newRounds[index], newRounds[index - 1]];
                                                                            newRounds.forEach((r, i) => r.roundNumber = i + 1);
                                                                            setFormData({ ...formData, rounds: newRounds });
                                                                        }}
                                                                    >
                                                                        <ChevronUp className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                                {index < formData.rounds.length - 1 && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            const newRounds = [...formData.rounds];
                                                                            [newRounds[index], newRounds[index + 1]] = [newRounds[index + 1], newRounds[index]];
                                                                            newRounds.forEach((r, i) => r.roundNumber = i + 1);
                                                                            setFormData({ ...formData, rounds: newRounds });
                                                                        }}
                                                                    >
                                                                        <ChevronDown className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-red-500 hover:text-red-700"
                                                                    onClick={() => {
                                                                        if (confirm('Remove this round?')) {
                                                                            const newRounds = formData.rounds.filter((_, i) => i !== index);
                                                                            newRounds.forEach((r, i) => r.roundNumber = i + 1);
                                                                            setFormData({ ...formData, rounds: newRounds });
                                                                        }
                                                                    }}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </CardHeader>
                                                    <CardContent className="space-y-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                            <div className="space-y-2">
                                                                <Label className="text-xs text-gray-500">Round Name</Label>
                                                                <Input
                                                                    value={round.name || ''}
                                                                    onChange={(e) => {
                                                                        const newRounds = [...formData.rounds];
                                                                        newRounds[index].name = e.target.value;
                                                                        setFormData({ ...formData, rounds: newRounds });
                                                                    }}
                                                                    placeholder={`Round ${round.roundNumber}`}
                                                                />
                                                            </div>

                                                            <div className="space-y-2">
                                                                <Label className="text-xs text-gray-500">Qualification Type</Label>
                                                                <Select
                                                                    value={round.qualifyType || QualifyType.PERCENTAGE}
                                                                    onValueChange={(val) => {
                                                                        const newRounds = [...formData.rounds];
                                                                        newRounds[index].qualifyType = val;
                                                                        setFormData({ ...formData, rounds: newRounds });
                                                                    }}
                                                                >
                                                                    <SelectTrigger>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value={QualifyType.PERCENTAGE}>Percentage (%)</SelectItem>
                                                                        <SelectItem value={QualifyType.FIXED}>Fixed Number</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>

                                                            <div className="space-y-2">
                                                                <Label className="text-xs text-gray-500">
                                                                    {round.qualifyType === QualifyType.PERCENTAGE ? 'Qualify %' : 'Qualify Count'}
                                                                </Label>
                                                                <Input
                                                                    type="number"
                                                                    value={round.qualifyValue || 50}
                                                                    onChange={(e) => {
                                                                        const newRounds = [...formData.rounds];
                                                                        newRounds[index].qualifyValue = parseInt(e.target.value) || 0;
                                                                        setFormData({ ...formData, rounds: newRounds });
                                                                    }}
                                                                    min={1}
                                                                    max={round.qualifyType === QualifyType.PERCENTAGE ? 100 : undefined}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <Label className="text-xs text-gray-500">Scheduled Date (Optional) <span className="text-xs text-gray-400">(IST, GMT+5:30)</span></Label>
                                                                <Input
                                                                    type="datetime-local"
                                                                    value={round.scheduledDate ? new Date(new Date(round.scheduledDate).getTime() + (5.5 * 60 * 60 * 1000)).toISOString().slice(0, 16) : ''}
                                                                    onChange={(e) => {
                                                                        const newRounds = [...formData.rounds];
                                                                        newRounds[index].scheduledDate = e.target.value 
                                                                            ? new Date(new Date(e.target.value).getTime() - (5.5 * 60 * 60 * 1000)).toISOString()
                                                                            : null;
                                                                        setFormData({ ...formData, rounds: newRounds });
                                                                    }}
                                                                />
                                                            </div>

                                                            <div className="flex items-center space-x-2 pt-6">
                                                                <Checkbox
                                                                    id={`verify-${index}`}
                                                                    checked={round.requireVerification !== false}
                                                                    onCheckedChange={(checked) => {
                                                                        const newRounds = [...formData.rounds];
                                                                        newRounds[index].requireVerification = checked;
                                                                        setFormData({ ...formData, rounds: newRounds });
                                                                    }}
                                                                />
                                                                <Label htmlFor={`verify-${index}`} className="text-sm">
                                                                    Require admin verification before advancement
                                                                </Label>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id={`final-${index}`}
                                                                checked={round.isFinal || false}
                                                                onCheckedChange={(checked) => {
                                                                    const newRounds = [...formData.rounds];
                                                                    newRounds[index].isFinal = checked;
                                                                    if (checked) {
                                                                        newRounds[index].name = newRounds[index].name || 'Final';
                                                                        newRounds[index].qualifyType = QualifyType.FIXED;
                                                                        newRounds[index].qualifyValue = 3;
                                                                    }
                                                                    setFormData({ ...formData, rounds: newRounds });
                                                                }}
                                                            />
                                                            <Label htmlFor={`final-${index}`} className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                                                                This is the Final Round (determines winners)
                                                            </Label>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}

                                            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-3 rounded-lg text-sm text-indigo-800 dark:text-indigo-200">
                                                <strong>Round Advancement Preview:</strong>
                                                <ul className="mt-2 space-y-1">
                                                    {formData.rounds.map((round, idx) => {
                                                        const prevRound = idx > 0 ? formData.rounds[idx - 1] : null;
                                                        let qualifyDesc = 'All registered';
                                                        if (prevRound) {
                                                            qualifyDesc = prevRound.qualifyType === QualifyType.PERCENTAGE
                                                                ? `Top ${prevRound.qualifyValue}% from ${prevRound.name}`
                                                                : `Top ${prevRound.qualifyValue} from ${prevRound.name}`;
                                                        }
                                                        return (
                                                            <li key={idx} className="flex items-center gap-2">
                                                                <Badge variant="outline" className="text-xs">{round.roundNumber}</Badge>
                                                                <span>{round.name || `Round ${round.roundNumber}`}</span>
                                                                <span className="text-indigo-600 dark:text-indigo-400">← {qualifyDesc}</span>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center space-x-2 border p-4 rounded-md">
                                    <Switch
                                        id="published"
                                        checked={formData.isPublished}
                                        onCheckedChange={(checked) => setFormData({ ...formData, isPublished: checked })}
                                    />
                                    <Label htmlFor="published">Publish Competition (Visible to public)</Label>
                                </div>

                                {/* EVENTS SELECTION */}
                                <div className="space-y-2">
                                    <Label>Events</Label>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {WCA_EVENTS.map(event => (
                                            <div key={event.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={event.id}
                                                    checked={formData.selectedEvents.includes(event.id)}
                                                    onCheckedChange={() => handleEventToggle(event.id)}
                                                />
                                                <label htmlFor={event.id}>{event.name}</label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* PER-EVENT SETTINGS (CUT-OFF & MAX TIME) */}
                                {formData.selectedEvents.length > 0 && (
                                    <div className="space-y-4 border-t pt-4">
                                        <div className="flex items-center gap-2">
                                            <Timer className="h-5 w-5 text-orange-500" />
                                            <Label className="text-lg font-semibold">Event Time Limits (WCA-Style)</Label>
                                        </div>
                                        <p className="text-sm text-gray-500">Configure cut-off and maximum time limits per event. All times in MM:SS format.</p>

                                        {formData.selectedEvents.map(eventId => {
                                            const settings = formData.eventSettings[eventId] || getDefaultEventSettings(eventId);
                                            const cutOffTime = formatTimeInput(settings.cutOffTime);
                                            const maxTime = formatTimeInput(settings.maxTimeLimit);

                                            return (
                                                <Card key={eventId} className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200">
                                                    <CardHeader className="py-3">
                                                        <CardTitle className="text-base flex items-center gap-2">
                                                            <Clock className="h-4 w-4" />
                                                            {getEventName(eventId)} ({settings.format})
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="space-y-4">
                                                        {/* Cut-Off Settings */}
                                                        <div className="space-y-3 p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                                                            <div className="flex items-center space-x-2">
                                                                <Checkbox
                                                                    id={`cutoff-${eventId}`}
                                                                    checked={settings.applyCutOff}
                                                                    onCheckedChange={(checked) => handleEventSettingChange(eventId, 'applyCutOff', checked)}
                                                                />
                                                                <Label htmlFor={`cutoff-${eventId}`} className="font-medium">Enable Cut-Off</Label>
                                                            </div>

                                                            {settings.applyCutOff && (
                                                                <div className="grid grid-cols-2 gap-4 pl-6 animate-in fade-in">
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs text-gray-600">Cut-Off Time (MM:SS)</Label>
                                                                        <div className="flex items-center gap-1">
                                                                            <Input
                                                                                type="number"
                                                                                min="0"
                                                                                max="59"
                                                                                className="w-16 text-center"
                                                                                value={cutOffTime.minutes}
                                                                                onChange={(e) => handleEventSettingChange(eventId, 'cutOffTime', parseTimeToMs(e.target.value, cutOffTime.seconds))}
                                                                            />
                                                                            <span className="font-bold">:</span>
                                                                            <Input
                                                                                type="number"
                                                                                min="0"
                                                                                max="59"
                                                                                className="w-16 text-center"
                                                                                value={cutOffTime.seconds}
                                                                                onChange={(e) => handleEventSettingChange(eventId, 'cutOffTime', parseTimeToMs(cutOffTime.minutes, e.target.value))}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs text-gray-600">Attempts to Beat Cut-Off</Label>
                                                                        <Select
                                                                            value={settings.cutOffAttempts.toString()}
                                                                            onValueChange={(val) => handleEventSettingChange(eventId, 'cutOffAttempts', parseInt(val))}
                                                                        >
                                                                            <SelectTrigger className="w-20">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="1">1</SelectItem>
                                                                                <SelectItem value="2">2</SelectItem>
                                                                                <SelectItem value="3">3</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Max Time Settings */}
                                                        <div className="space-y-3 p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                                                            <div className="flex items-center space-x-2">
                                                                <Checkbox
                                                                    id={`maxtime-${eventId}`}
                                                                    checked={settings.applyMaxTime}
                                                                    onCheckedChange={(checked) => handleEventSettingChange(eventId, 'applyMaxTime', checked)}
                                                                />
                                                                <Label htmlFor={`maxtime-${eventId}`} className="font-medium">Enable Maximum Time Limit</Label>
                                                            </div>

                                                            {settings.applyMaxTime && (
                                                                <div className="pl-6 animate-in fade-in">
                                                                    <Label className="text-xs text-gray-600">Maximum Time (MM:SS)</Label>
                                                                    <div className="flex items-center gap-1 mt-1">
                                                                        <Input
                                                                            type="number"
                                                                            min="0"
                                                                            max="59"
                                                                            className="w-16 text-center"
                                                                            value={maxTime.minutes}
                                                                            onChange={(e) => handleEventSettingChange(eventId, 'maxTimeLimit', parseTimeToMs(e.target.value, maxTime.seconds))}
                                                                        />
                                                                        <span className="font-bold">:</span>
                                                                        <Input
                                                                            type="number"
                                                                            min="0"
                                                                            max="59"
                                                                            className="w-16 text-center"
                                                                            value={maxTime.seconds}
                                                                            onChange={(e) => handleEventSettingChange(eventId, 'maxTimeLimit', parseTimeToMs(maxTime.minutes, e.target.value))}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* SCRAMBLES */}
                                {formData.selectedEvents.length > 0 && (
                                    <div className="space-y-4 border-t pt-4">
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                            <div>
                                                <Label className="text-lg">
                                                    {formData.mode === CompetitionMode.TOURNAMENT
                                                        ? 'Scrambles (5 per event per round)'
                                                        : 'Scrambles (5 per event required)'}
                                                </Label>
                                                <p className="text-sm text-gray-500 mt-1">
                                                    Enter WCA-compliant scrambles manually for each event
                                                </p>
                                            </div>
                                            {formData.mode === CompetitionMode.TOURNAMENT && (
                                                <Badge className="bg-indigo-100 text-indigo-700">
                                                    Round-specific scrambles
                                                </Badge>
                                            )}
                                        </div>

                                        {formData.mode === CompetitionMode.TOURNAMENT ? (
                                            // Tournament mode: scrambles per round
                                            <div className="space-y-6">
                                                {formData.rounds.map((round, roundIdx) => (
                                                    <div key={round.roundNumber} className="border rounded-lg p-4 bg-indigo-50/30">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <h4 className="font-semibold text-indigo-900 flex items-center gap-2">
                                                                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">
                                                                    {round.roundNumber}
                                                                </span>
                                                                {round.name || `Round ${round.roundNumber}`} Scrambles
                                                            </h4>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {formData.selectedEvents.map(eventId => (
                                                                <Card key={`${round.roundNumber}-${eventId}`} className="bg-white dark:bg-slate-900">
                                                                    <CardHeader className="py-2 flex flex-row items-center justify-between">
                                                                        <CardTitle className="text-sm">{getEventName(eventId)}</CardTitle>
                                                                        {formData.scrambles[eventId]?.[round.roundNumber] && (
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => copyAllScramblesForEvent(eventId, round.roundNumber)}
                                                                                className="h-6 px-2"
                                                                            >
                                                                                <Copy className="h-3 w-3 mr-1" />
                                                                                Copy All
                                                                            </Button>
                                                                        )}
                                                                    </CardHeader>
                                                                    <CardContent className="space-y-2">
                                                                        {[0, 1, 2, 3, 4].map(i => {
                                                                            const scrambleId = `${eventId}-R${round.roundNumber}-${i}`;
                                                                            const scrambleValue = formData.scrambles[eventId]?.[round.roundNumber]?.[i] || '';
                                                                            return (
                                                                                <div key={i} className="flex gap-2">
                                                                                    <Input
                                                                                        placeholder={`R${round.roundNumber} Scramble ${i + 1}`}
                                                                                        value={scrambleValue}
                                                                                        onChange={(e) => handleRoundScrambleChange(eventId, round.roundNumber, i, e.target.value)}
                                                                                        className="font-mono text-xs flex-1"
                                                                                    />
                                                                                    {scrambleValue && (
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            onClick={() => copyScrambleToClipboard(scrambleValue, scrambleId)}
                                                                                            className="px-2"
                                                                                        >
                                                                                            {copiedScramble === scrambleId ? (
                                                                                                <Check className="h-3 w-3 text-green-600" />
                                                                                            ) : (
                                                                                                <Copy className="h-3 w-3" />
                                                                                            )}
                                                                                        </Button>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </CardContent>
                                                                </Card>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            // Standard mode: single set of scrambles
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {formData.selectedEvents.map(eventId => (
                                                    <Card key={eventId} className="bg-slate-50 dark:bg-slate-900">
                                                        <CardHeader className="py-2 flex flex-row items-center justify-between">
                                                            <CardTitle className="text-sm">{getEventName(eventId)}</CardTitle>
                                                            {formData.scrambles[eventId] && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => copyAllScramblesForEvent(eventId)}
                                                                    className="h-6 px-2"
                                                                >
                                                                    <Copy className="h-3 w-3 mr-1" />
                                                                    Copy All
                                                                </Button>
                                                            )}
                                                        </CardHeader>
                                                        <CardContent className="space-y-2">
                                                            {[0, 1, 2, 3, 4].map(i => {
                                                                const scrambleId = `${eventId}-${i}`;
                                                                const scrambleValue = formData.scrambles[eventId]?.[i] || '';
                                                                return (
                                                                    <div key={i} className="flex gap-2">
                                                                        <Input
                                                                            placeholder={`Scramble ${i + 1}`}
                                                                            value={scrambleValue}
                                                                            onChange={(e) => handleScrambleChange(eventId, i, e.target.value)}
                                                                            className="font-mono text-xs flex-1"
                                                                        />
                                                                        {scrambleValue && (
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => copyScrambleToClipboard(scrambleValue, scrambleId)}
                                                                                className="px-2"
                                                                            >
                                                                                {copiedScramble === scrambleId ? (
                                                                                    <Check className="h-3 w-3 text-green-600" />
                                                                                ) : (
                                                                                    <Copy className="h-3 w-3" />
                                                                                )}
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <Button type="submit">{editingComp ? 'Update Competition' : 'Create Competition'}</Button>
                                    {editingComp && <Button type="button" variant="outline" onClick={() => { setEditingComp(null); resetForm(); }}>Cancel Edit</Button>}
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Dates</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Mode</TableHead>
                                    <TableHead>Events</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {competitions.map(comp => (
                                    <TableRow key={comp.id}>
                                        <TableCell className="font-medium">{comp.name}</TableCell>
                                        <TableCell>
                                            <div className="text-xs">
                                                <div>Start: {new Date(comp.startDate).toLocaleDateString()}</div>
                                                <div>End: {new Date(comp.endDate).toLocaleDateString()}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={comp.type === 'FREE' ? 'secondary' : 'default'}>
                                                {comp.type} {comp.type === 'PAID' && `(${comp.currency})`}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {comp.mode === CompetitionMode.TOURNAMENT ? (
                                                <Badge className="bg-indigo-600">
                                                    <Layers className="h-3 w-3 mr-1" />
                                                    Tournament ({comp.rounds?.length || 0} rounds)
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline">Standard</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>{comp.events?.length || 0} Events</TableCell>
                                        <TableCell>
                                            {comp.isPublished ? <Badge className="bg-green-600">Published</Badge> : <Badge variant="outline">Draft</Badge>}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm" onClick={() => loadCompForEdit(comp)}>Edit</Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => router.push(`/admin/results/${comp.id}`)}
                                                className="text-blue-600 hover:text-blue-700"
                                            >
                                                <Trophy className="h-4 w-4 mr-1" />
                                                Results
                                            </Button>
                                            {comp.mode === CompetitionMode.TOURNAMENT && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => router.push(`/admin/tournament/${comp.id}`)}
                                                    className="text-indigo-600 hover:text-indigo-700"
                                                >
                                                    <Settings2 className="h-4 w-4 mr-1" />
                                                    Manage
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteCompetition(comp.id, comp.name)}
                                                className="text-red-600 hover:text-red-700"
                                                title="Delete Competition"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                <TabsContent value="users">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>User Management</CardTitle>
                                <Badge variant="secondary">Total: {users.length}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map(u => (
                                        <TableRow key={u.id}>
                                            <TableCell className="font-medium">{u.displayName || 'N/A'}</TableCell>
                                            <TableCell>{u.email}</TableCell>
                                            <TableCell>
                                                <Badge variant={u.status === 'SUSPENDED' ? 'destructive' : 'outline'}>
                                                    {u.status || 'ACTIVE'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleToggleUserStatus(u.id, u.status || 'ACTIVE')}
                                                        className={u.status === 'SUSPENDED' ? "text-green-600 hover:text-green-700 hover:bg-green-50" : "text-orange-600 hover:text-orange-700 hover:bg-orange-50"}
                                                        title={u.status === 'SUSPENDED' ? "Activate User" : "Suspend User"}
                                                    >
                                                        {u.status === 'SUSPENDED' ? <ShieldCheck className="h-4 w-4 mr-1" /> : <Ban className="h-4 w-4 mr-1" />}
                                                        {u.status === 'SUSPENDED' ? "Activate" : "Suspend"}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteUser(u.id)}
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        title="Delete User"
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-1" />
                                                        Delete
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="battles">
                    <div className="space-y-6">
                        {/* Battles Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Sword className="w-5 h-5" />
                                    Battle Management
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-2 mb-4">
                                    <Button 
                                        variant={battleFilter === 'all' ? 'default' : 'outline'} 
                                        onClick={() => setBattleFilter('all')}
                                    >
                                        All
                                    </Button>
                                    <Button 
                                        variant={battleFilter === 'waiting' ? 'default' : 'outline'} 
                                        onClick={() => setBattleFilter('waiting')}
                                    >
                                        Waiting
                                    </Button>
                                    <Button 
                                        variant={battleFilter === 'live' ? 'default' : 'outline'} 
                                        onClick={() => setBattleFilter('live')}
                                    >
                                        Live
                                    </Button>
                                    <Button 
                                        variant={battleFilter === 'completed' ? 'default' : 'outline'} 
                                        onClick={() => setBattleFilter('completed')}
                                    >
                                        Completed
                                    </Button>
                                    <Button variant="outline" onClick={() => {
                                        const q = query(collection(db, 'battles'), orderBy('createdAt', 'desc'), limit(50));
                                        getDocs(q).then(snap => {
                                            const data = [];
                                            snap.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
                                            setBattles(data);
                                        });
                                    }}>
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Refresh
                                    </Button>
                                </div>

                                    <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Battle ID</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Players</TableHead>
                                            <TableHead>Score</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Format</TableHead>
                                            <TableHead>Created</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {battles.filter(b => battleFilter === 'all' || b.status === battleFilter).slice(0, 20).map(battle => (
                                            <TableRow key={battle.id}>
                                                <TableCell className="font-mono text-xs">{battle.id.slice(0, 8)}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">
                                                        {battle.battleType === 'quickBattle' || battle.battleType === 'matchmaking' ? 'Quick' : 
                                                         battle.battleType === 'teamBattle' ? 'Team' : 'Custom'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-xs">
                                                        <div>{battle.player1Name || battle.player1?.slice(0,8) || 'Unknown'}</div>
                                                        <div className="text-zinc-500">vs</div>
                                                        <div>{battle.player2Name || battle.player2?.slice(0,8) || 'Unknown'}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {battle.status === 'completed' ? (
                                                        <span className="text-xs">
                                                            {battle.scores?.player1 || 0} - {battle.scores?.player2 || 0}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-zinc-500">
                                                            {battle.players?.length || 2} players
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={battle.status === 'live' ? 'default' : 
                                                                   battle.status === 'completed' ? 'secondary' : 'outline'}>
                                                        {battle.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{battle.format}</TableCell>
                                                <TableCell className="text-xs">
                                                    {battle.createdAt?.toDate?.()?.toLocaleDateString() || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        onClick={() => window.open(`/battle/${battle.id}`, '_blank')}
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        className="text-red-500"
                                                        onClick={async () => {
                                                            if (confirm('Delete this battle?')) {
                                                                await deleteDoc(doc(db, 'battles', battle.id));
                                                                setBattles(battles.filter(b => b.id !== battle.id));
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Reports Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-red-600">
                                    <Flag className="w-5 h-5" />
                                    Battle Reports
                                    {battleReports.filter(r => r.status === 'pending').length > 0 && (
                                        <Badge variant="destructive">
                                            {battleReports.filter(r => r.status === 'pending').length} Pending
                                        </Badge>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-2 mb-4">
                                    <Button 
                                        variant={reportFilter === 'pending' ? 'default' : 'outline'} 
                                        onClick={() => setReportFilter('pending')}
                                    >
                                        Pending
                                    </Button>
                                    <Button 
                                        variant={reportFilter === 'reviewed' ? 'default' : 'outline'} 
                                        onClick={() => setReportFilter('reviewed')}
                                    >
                                        Reviewed
                                    </Button>
                                    <Button 
                                        variant={reportFilter === 'resolved' ? 'default' : 'outline'} 
                                        onClick={() => setReportFilter('resolved')}
                                    >
                                        Resolved
                                    </Button>
                                    <Button variant="outline" onClick={() => {
                                        fetch('/api/battle/report').then(r => r.json()).then(data => {
                                            if (data.reports) setBattleReports(data.reports);
                                        });
                                    }}>
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Refresh
                                    </Button>
                                </div>

                                <div className="space-y-4">
                                    {battleReports.filter(r => reportFilter === 'all' || r.status === reportFilter).map(report => {
                                        const reportReasonLabels = {
                                            'suspicious_times': 'Suspicious solve times',
                                            'same_scramble': 'Same scramble results',
                                            'suspected_cheating': 'Suspected cheating',
                                            'timer_manipulation': 'Timer manipulation',
                                            'unreal_performance': 'Unreal performance',
                                            'other': 'Other'
                                        };
                                        return (
                                        <div key={report.id} className="bg-zinc-800 rounded-lg p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <Badge variant="outline">{reportReasonLabels[report.reason] || report.reason}</Badge>
                                                    <span className="text-xs text-zinc-500 ml-2">
                                                        {report.createdAt?.toDate?.()?.toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <Badge variant={report.status === 'pending' ? 'destructive' : 'secondary'}>
                                                    {report.status}
                                                </Badge>
                                            </div>
                                            
                                            <div className="text-sm mb-2">
                                                <span className="text-zinc-400">Reporter: </span>
                                                <span className="text-white">{report.reporterId?.slice(0,8)}</span>
                                                <span className="text-zinc-400"> → Reported: </span>
                                                <span className="text-red-400">{report.reportedUserId?.slice(0,8)}</span>
                                            </div>
                                            
                                            {report.battleDetails && (
                                                <div className="text-xs text-zinc-500 mb-2">
                                                    Battle: {report.battleDetails.player1Name} vs {report.battleDetails.player2Name} | 
                                                    Score: {report.battleDetails.scores?.player1 || 0} - {report.battleDetails.scores?.player2 || 0}
                                                </div>
                                            )}
                                            
                                            <p className="text-sm text-zinc-400 mb-3">{report.description}</p>
                                            
                                            <div className="flex flex-wrap gap-2">
                                                <Button 
                                                    size="sm" 
                                                    variant="outline"
                                                    onClick={() => window.open(`/battle/${report.battleId}`, '_blank')}
                                                >
                                                    View Battle
                                                </Button>
                                                
                                                {report.status === 'pending' && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="outline"
                                                        onClick={async () => {
                                                            setReportActionLoading(report.id);
                                                            await fetch('/api/battle/report', {
                                                                method: 'PUT',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ reportId: report.id, status: 'reviewed' })
                                                            });
                                                            setBattleReports(battleReports.map(r => 
                                                                r.id === report.id ? { ...r, status: 'reviewed' } : r
                                                            ));
                                                            setReportActionLoading(null);
                                                        }}
                                                        disabled={reportActionLoading === report.id}
                                                    >
                                                        Mark Reviewed
                                                    </Button>
                                                )}
                                                
                                                {/* Switch Winner Dropdown */}
                                                <div className="relative">
                                                    <Button 
                                                        size="sm" 
                                                        variant="outline"
                                                        className="bg-yellow-600 hover:bg-yellow-500"
                                                        onClick={() => setSelectedReport(selectedReport === report.id ? null : report.id)}
                                                    >
                                                        Switch Winner
                                                    </Button>
                                                    
                                                    {selectedReport === report.id && report.battleDetails && (
                                                        <div className="absolute top-full left-0 mt-1 bg-zinc-700 rounded-lg shadow-lg z-10 py-1 min-w-[180px]">
                                                            <button
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-600 text-white"
                                                                onClick={async () => {
                                                                    const reason = prompt('Reason for switching winner:', 'Cheating confirmed');
                                                                    if (!reason) return;
                                                                    setReportActionLoading(report.id);
                                                                    await fetch('/api/battle/switch-winner', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({
                                                                            battleId: report.battleId,
                                                                            newWinnerUid: report.battleDetails.player1,
                                                                            adminUserId: user.uid,
                                                                            reason: reason
                                                                        })
                                                                    });
                                                                    await fetch('/api/battle/report', {
                                                                        method: 'PUT',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ reportId: report.id, status: 'resolved', adminAction: 'winner_switched' })
                                                                    });
                                                                    setBattleReports(battleReports.map(r => 
                                                                        r.id === report.id ? { ...r, status: 'resolved', adminAction: 'winner_switched' } : r
                                                                    ));
                                                                    setSelectedReport(null);
                                                                    setReportActionLoading(null);
                                                                    alert('Winner switched successfully');
                                                                }}
                                                            >
                                                                Make {report.battleDetails.player1Name} Win
                                                            </button>
                                                            <button
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-600 text-white"
                                                                onClick={async () => {
                                                                    const reason = prompt('Reason for switching winner:', 'Cheating confirmed');
                                                                    if (!reason) return;
                                                                    setReportActionLoading(report.id);
                                                                    await fetch('/api/battle/switch-winner', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({
                                                                            battleId: report.battleId,
                                                                            newWinnerUid: report.battleDetails.player2,
                                                                            adminUserId: user.uid,
                                                                            reason: reason
                                                                        })
                                                                    });
                                                                    await fetch('/api/battle/report', {
                                                                        method: 'PUT',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ reportId: report.id, status: 'resolved', adminAction: 'winner_switched' })
                                                                    });
                                                                    setBattleReports(battleReports.map(r => 
                                                                        r.id === report.id ? { ...r, status: 'resolved', adminAction: 'winner_switched' } : r
                                                                    ));
                                                                    setSelectedReport(null);
                                                                    setReportActionLoading(null);
                                                                    alert('Winner switched successfully');
                                                                }}
                                                            >
                                                                Make {report.battleDetails.player2Name} Win
                                                            </button>
                                                            <button
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-600 text-red-400"
                                                                onClick={async () => {
                                                                    const reason = prompt('Reason for deleting battle:', 'Invalid battle');
                                                                    if (!reason) return;
                                                                    setReportActionLoading(report.id);
                                                                    await fetch('/api/battle/invalidate', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({
                                                                            battleId: report.battleId,
                                                                            adminUserId: user.uid,
                                                                            reason: reason
                                                                        })
                                                                    });
                                                                    await fetch('/api/battle/report', {
                                                                        method: 'PUT',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ reportId: report.id, status: 'resolved', adminAction: 'battle_deleted' })
                                                                    });
                                                                    setBattleReports(battleReports.map(r => 
                                                                        r.id === report.id ? { ...r, status: 'resolved', adminAction: 'battle_deleted' } : r
                                                                    ));
                                                                    setSelectedReport(null);
                                                                    setReportActionLoading(null);
                                                                    alert('Battle invalidated successfully');
                                                                }}
                                                            >
                                                                Delete Battle
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Ban User Dropdown */}
                                                <div className="relative">
                                                    <Button 
                                                        size="sm" 
                                                        className="bg-red-600 hover:bg-red-500"
                                                        onClick={() => setSelectedReport(selectedReport === `ban-${report.id}` ? null : `ban-${report.id}`)}
                                                    >
                                                        Ban User
                                                    </Button>
                                                    
                                                    {selectedReport === `ban-${report.id}` && (
                                                        <div className="absolute top-full left-0 mt-1 bg-zinc-700 rounded-lg shadow-lg z-10 py-1 min-w-[180px]">
                                                            <button
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-600 text-white"
                                                                onClick={async () => {
                                                                    setReportActionLoading(report.id);
                                                                    await fetch('/api/admin/ban', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({
                                                                            userId: report.reportedUserId,
                                                                            reason: `Battle Report: ${report.reason}`,
                                                                            banType: 'all',
                                                                            banDuration: '1',
                                                                            adminUserId: user.uid
                                                                        })
                                                                    });
                                                                    await fetch('/api/battle/report', {
                                                                        method: 'PUT',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ reportId: report.id, status: 'resolved', adminAction: 'banned_1day' })
                                                                    });
                                                                    setBattleReports(battleReports.map(r => 
                                                                        r.id === report.id ? { ...r, status: 'resolved', adminAction: 'banned_1day' } : r
                                                                    ));
                                                                    setSelectedReport(null);
                                                                    setReportActionLoading(null);
                                                                    alert('User banned for 1 day');
                                                                }}
                                                            >
                                                                Ban 1 Day
                                                            </button>
                                                            <button
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-600 text-white"
                                                                onClick={async () => {
                                                                    setReportActionLoading(report.id);
                                                                    await fetch('/api/admin/ban', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({
                                                                            userId: report.reportedUserId,
                                                                            reason: `Battle Report: ${report.reason}`,
                                                                            banType: 'all',
                                                                            banDuration: '7',
                                                                            adminUserId: user.uid
                                                                        })
                                                                    });
                                                                    await fetch('/api/battle/report', {
                                                                        method: 'PUT',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ reportId: report.id, status: 'resolved', adminAction: 'banned_7days' })
                                                                    });
                                                                    setBattleReports(battleReports.map(r => 
                                                                        r.id === report.id ? { ...r, status: 'resolved', adminAction: 'banned_7days' } : r
                                                                    ));
                                                                    setSelectedReport(null);
                                                                    setReportActionLoading(null);
                                                                    alert('User banned for 7 days');
                                                                }}
                                                            >
                                                                Ban 7 Days
                                                            </button>
                                                            <button
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-600 text-white"
                                                                onClick={async () => {
                                                                    setReportActionLoading(report.id);
                                                                    await fetch('/api/admin/ban', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({
                                                                            userId: report.reportedUserId,
                                                                            reason: `Battle Report: ${report.reason}`,
                                                                            banType: 'all',
                                                                            banDuration: '30',
                                                                            adminUserId: user.uid
                                                                        })
                                                                    });
                                                                    await fetch('/api/battle/report', {
                                                                        method: 'PUT',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ reportId: report.id, status: 'resolved', adminAction: 'banned_30days' })
                                                                    });
                                                                    setBattleReports(battleReports.map(r => 
                                                                        r.id === report.id ? { ...r, status: 'resolved', adminAction: 'banned_30days' } : r
                                                                    ));
                                                                    setSelectedReport(null);
                                                                    setReportActionLoading(null);
                                                                    alert('User banned for 30 days');
                                                                }}
                                                            >
                                                                Ban 30 Days
                                                            </button>
                                                            <button
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-600 text-red-400"
                                                                onClick={async () => {
                                                                    setReportActionLoading(report.id);
                                                                    await fetch('/api/admin/ban', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({
                                                                            userId: report.reportedUserId,
                                                                            reason: `Battle Report: ${report.reason}`,
                                                                            banType: 'all',
                                                                            banDuration: 'permanent',
                                                                            adminUserId: user.uid
                                                                        })
                                                                    });
                                                                    await fetch('/api/battle/report', {
                                                                        method: 'PUT',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ reportId: report.id, status: 'resolved', adminAction: 'banned_permanent' })
                                                                    });
                                                                    setBattleReports(battleReports.map(r => 
                                                                        r.id === report.id ? { ...r, status: 'resolved', adminAction: 'banned_permanent' } : r
                                                                    ));
                                                                    setSelectedReport(null);
                                                                    setReportActionLoading(null);
                                                                    alert('User banned permanently');
                                                                }}
                                                            >
                                                                Ban Permanently
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        );
                                    })}
                                    {battleReports.filter(r => reportFilter === 'all' || r.status === reportFilter).length === 0 && (
                                        <p className="text-center text-zinc-500 py-4">No reports found</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Banned Users Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-red-600">
                                    <Ban className="w-5 h-5" />
                                    Banned Users
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Button variant="outline" onClick={() => {
                                    fetch('/api/admin/ban').then(r => r.json()).then(data => {
                                        if (data.bans) setBannedUsers(data.bans);
                                    });
                                }} className="mb-4">
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Refresh Bans
                                </Button>

                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>User ID</TableHead>
                                            <TableHead>Reason</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Banned At</TableHead>
                                            <TableHead>Expires</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {bannedUsers.map(ban => (
                                            <TableRow key={ban.id}>
                                                <TableCell className="font-mono text-xs">{ban.userId?.slice(0, 8)}</TableCell>
                                                <TableCell className="text-sm">{ban.reason}</TableCell>
                                                <TableCell><Badge variant="outline">{ban.banType}</Badge></TableCell>
                                                <TableCell className="text-xs">{ban.bannedAt?.toDate?.()?.toLocaleDateString()}</TableCell>
                                                <TableCell className="text-xs">
                                                    {ban.expiresAt ? ban.expiresAt.toDate()?.toLocaleDateString() : 'Permanent'}
                                                </TableCell>
                                                <TableCell>
                                                    <Button 
                                                        size="sm" 
                                                        variant="outline"
                                                        onClick={async () => {
                                                            if (confirm('Lift this ban?')) {
                                                                await fetch('/api/admin/ban', {
                                                                    method: 'PUT',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ banId: ban.id, action: 'lift', adminUserId: user.uid })
                                                                });
                                                                setBannedUsers(bannedUsers.filter(b => b.id !== ban.id));
                                                            }
                                                        }}
                                                    >
                                                        Lift Ban
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {bannedUsers.length === 0 && (
                                    <p className="text-center text-zinc-500 py-4">No banned users</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="payments">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Payment History</CardTitle>
                            <Button variant="outline" onClick={handleExportPayments}>
                                <FileDown className="mr-2 h-4 w-4" />
                                Export CSV
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Competition</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Coupon</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {payments.map(p => (
                                        <TableRow key={p.id}>
                                            <TableCell>{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                                            <TableCell className="font-medium text-blue-600">{getCompetitionName(p.competitionId)}</TableCell>
                                            <TableCell>{p.userEmail}</TableCell>
                                            <TableCell className="font-mono">
                                                {p.couponCode ? (
                                                    <div className="text-xs">
                                                        <div className="line-through text-gray-400">₹{p.originalAmount}</div>
                                                        <div className="text-green-600 font-bold">₹{p.finalAmount}</div>
                                                    </div>
                                                ) : (
                                                    <span>                                                {p.currency} {p.finalAmount || p.amount}</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {p.couponCode ? (
                                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                                        <Tag className="h-3 w-3 mr-1" />
                                                        {p.couponCode}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={p.status === 'SUCCESS' ? 'default' : 'secondary'}>
                                                    {p.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="coupons" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>{editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCouponSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Coupon Code</Label>
                                        <Input
                                            value={couponForm.code}
                                            onChange={e => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                                            placeholder="e.g., MCUBES50"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Discount Type</Label>
                                        <Select value={couponForm.type} onValueChange={val => setCouponForm({ ...couponForm, type: val })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="flat">Flat (₹)</SelectItem>
                                                <SelectItem value="percentage">Percentage (%)</SelectItem>
                                                <SelectItem value="full">100% Free</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {couponForm.type !== 'full' && (
                                        <div className="space-y-2">
                                            <Label>Value {couponForm.type === 'percentage' ? '(%)' : '(₹)'}</Label>
                                            <Input
                                                type="number"
                                                value={couponForm.value}
                                                onChange={e => setCouponForm({ ...couponForm, value: e.target.value })}
                                                required
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Total Usage Limit</Label>
                                        <Input
                                            type="number"
                                            value={couponForm.usageLimitTotal}
                                            onChange={e => setCouponForm({ ...couponForm, usageLimitTotal: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Per User Limit</Label>
                                        <Input
                                            type="number"
                                            value={couponForm.usageLimitPerUser}
                                            onChange={e => setCouponForm({ ...couponForm, usageLimitPerUser: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Expiration Date (Optional)</Label>
                                        <Input
                                            type="datetime-local"
                                            value={couponForm.expiresAt}
                                            onChange={e => setCouponForm({ ...couponForm, expiresAt: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="coupon-active"
                                            checked={couponForm.active}
                                            onCheckedChange={(checked) => setCouponForm({ ...couponForm, active: checked })}
                                        />
                                        <Label htmlFor="coupon-active">Active</Label>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="new-users-only"
                                            checked={couponForm.newUsersOnly}
                                            onCheckedChange={(checked) => setCouponForm({ ...couponForm, newUsersOnly: checked })}
                                        />
                                        <Label htmlFor="new-users-only">New Users Only</Label>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button type="submit">{editingCoupon ? 'Update Coupon' : 'Create Coupon'}</Button>
                                    {editingCoupon && (
                                        <Button type="button" variant="outline" onClick={() => { setEditingCoupon(null); resetCouponForm(); }}>
                                            Cancel Edit
                                        </Button>
                                    )}
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Active Coupons</CardTitle>
                            <div className="flex gap-2">
                                <Badge variant="secondary">Total: {coupons.length}</Badge>
                                <Button variant="outline" size="sm" onClick={handleExportCouponUsages}>
                                    <FileDown className="mr-2 h-4 w-4" />
                                    Export Usage
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Code</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Value</TableHead>
                                        <TableHead>Usage</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {coupons.map(coupon => (
                                        <TableRow key={coupon.id}>
                                            <TableCell className="font-mono font-bold">{coupon.code}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {coupon.type === 'full' ? '100% Free' :
                                                        coupon.type === 'flat' ? 'Flat ₹' : 'Percentage %'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {coupon.type === 'full' ? 'Free Entry' :
                                                    coupon.type === 'flat' ? `₹${coupon.value}` : `${coupon.value}%`}
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs">
                                                    <div>{coupon.usedCount || 0} / {coupon.usageLimitTotal || '∞'}</div>
                                                    <div className="text-gray-500">Per user: {coupon.usageLimitPerUser || 1}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <Badge variant={coupon.active ? 'default' : 'secondary'}>
                                                        {coupon.active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                    {coupon.expiresAt && (
                                                        <span className="text-xs text-gray-500">
                                                            Expires: {new Date(coupon.expiresAt.toDate ? coupon.expiresAt.toDate() : coupon.expiresAt).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                    {coupon.newUsersOnly && (
                                                        <Badge variant="outline" className="text-xs">New Users Only</Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => loadCouponForEdit(coupon)}
                                                    >
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleToggleCouponStatus(coupon.id, coupon.active)}
                                                        className={coupon.active ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50" : "text-green-600 hover:text-green-700 hover:bg-green-50"}
                                                    >
                                                        {coupon.active ? 'Disable' : 'Enable'}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteCoupon(coupon.id)}
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Coupon Usage History</CardTitle>
                            <Badge variant="secondary">{couponUsages.length} uses</Badge>
                        </CardHeader>
                        <CardContent>
                            {couponUsages.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    No coupon usage data yet
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Coupon</TableHead>
                                            <TableHead>User</TableHead>
                                            <TableHead>Competition</TableHead>
                                            <TableHead>Original</TableHead>
                                            <TableHead>Discount</TableHead>
                                            <TableHead>Final</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {couponUsages.slice(0, 50).map(usage => (
                                            <TableRow key={usage.id}>
                                                <TableCell>
                                                    {usage.usedAt ? new Date(usage.usedAt.toDate ? usage.usedAt.toDate() : usage.usedAt).toLocaleString() : 'N/A'}
                                                </TableCell>
                                                <TableCell className="font-mono font-bold">{usage.couponCode}</TableCell>
                                                <TableCell>{usage.userId}</TableCell>
                                                <TableCell>{getCompetitionName(usage.competitionId)}</TableCell>
                                                <TableCell>₹{usage.originalAmount}</TableCell>
                                                <TableCell className="text-green-600">-₹{usage.discountAmount}</TableCell>
                                                <TableCell className="font-bold">₹{usage.finalAmount}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="audit">
                    <Card>
                        <CardHeader><CardTitle>System Logs</CardTitle></CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {auditLogs.map(log => (
                                    <div key={log.id} className="text-sm border-b pb-2">
                                        <span className="font-bold">{log.action}</span> - {new Date(log.timestamp).toLocaleString()}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {isSuperAdmin && (
                    <TabsContent value="verification">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-purple-600 flex items-center gap-2">
                                        <ShieldCheck className="h-5 w-5" />
                                        Identity Verification Center
                                    </CardTitle>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Manage user identity verifications and monitor duplicates
                                    </p>
                                </div>
                                <Button variant="outline" onClick={() => router.push('/admin/verification')}>
                                    Open Full Center
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-8 text-gray-500">
                                    <ShieldCheck className="h-12 w-12 mx-auto mb-4 text-purple-400" />
                                    <p>Click &quot;Open Full Center&quot; to access the complete verification management system.</p>
                                    <p className="text-sm mt-2">There you can:</p>
                                    <ul className="text-sm mt-2 list-disc list-inside text-left max-w-md mx-auto">
                                        <li>View all pending, verified, and rejected verifications</li>
                                        <li>Detect duplicate identity attempts</li>
                                        <li>Force re-verification for users</li>
                                        <li>Suspend accounts with fraudulent verification</li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}