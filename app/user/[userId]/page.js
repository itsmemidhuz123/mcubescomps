'use client'

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, MapPin, Trophy, Timer, History, ArrowLeft, Medal } from 'lucide-react';
import { getEventName } from '@/lib/wcaEvents';
import EventIcon from '@/lib/EventIcon';

export default function UserProfile() {
    const params = useParams();
    const router = useRouter();
    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState({
        totalComps: 0,
        totalEvents: 0,
        pbs: {} // { eventId: { single: X, average: Y } }
    });
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (params.userId) {
            fetchUserData();
        }
    }, [params.userId]);

    async function fetchUserData() {
        try {
            // 1. Fetch User Document
            const userDoc = await getDoc(doc(db, 'users', params.userId));
            if (!userDoc.exists()) {
                setLoading(false);
                return;
            }

            const userData = userDoc.data();

            // Filter out private info (email, payment history, admin status)
            const publicProfile = {
                uid: userData.uid,
                displayName: userData.displayName,
                username: userData.username,
                wcaStyleId: userData.wcaStyleId,
                wcaId: userData.wcaId,
                country: userData.country,
                photoURL: userData.photoURL,
                createdAt: userData.createdAt,
                bio: userData.bio
            };
            setProfile(publicProfile);

            // 2. Fetch Registrations (for history)
            const regsQuery = query(
                collection(db, 'registrations'),
                where('userId', '==', params.userId),
                orderBy('createdAt', 'desc')
            );
            const regsSnap = await getDocs(regsQuery);
            const regsData = regsSnap.docs.map(d => d.data());

            setHistory(regsData);

            // 3. Fetch Solves (for PBs)
            const solvesQuery = query(
                collection(db, 'solves'),
                where('userId', '==', params.userId)
            );
            const solvesSnap = await getDocs(solvesQuery);

            // Calculate PBs
            const pbs = {};
            const solves = solvesSnap.docs.map(d => d.data());

            solves.forEach(solve => {
                const eventId = solve.eventId;
                if (!pbs[eventId]) pbs[eventId] = { single: Infinity, average: Infinity };

                // Check Single
                const time = Number(solve.time);
                if (time > 0 && time < pbs[eventId].single) {
                    pbs[eventId].single = time;
                }

                // Average is harder to calc from raw solves without grouping by round
                // For now, we'll try to find if we stored average in the solve doc 
                // (usually Ao5 is calculated at the end of a round)
                // If not available, we skip average or need a complex aggregation
            });

            // Simple count stats
            setStats({
                totalComps: regsData.length,
                totalEvents: solves.reduce((acc, curr) => acc.add(curr.eventId), new Set()).size,
                pbs
            });

        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    }

    const formatTime = (ms) => {
        if (ms === Infinity || !ms) return '-';
        const date = new Date(ms);
        const m = date.getMinutes();
        const s = date.getSeconds();
        const cs = Math.floor(date.getMilliseconds() / 10);
        return `${m > 0 ? m + ':' : ''}${s}.${cs.toString().padStart(2, '0')}`;
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading Profile...</div>;
    if (!profile) return <div className="min-h-screen flex items-center justify-center">User not found</div>;

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="container mx-auto px-4 max-w-5xl">
                <Button variant="ghost" onClick={() => router.back()} className="mb-6">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>

                {/* Profile Header */}
                <Card className="mb-8 overflow-hidden">
                    <div className="h-32 bg-gradient-to-r from-blue-600 to-violet-600"></div>
                    <CardContent className="relative pt-0 pb-8 px-8">
                        <div className="flex flex-col md:flex-row items-start gap-6 -mt-12">
                            <Avatar className="h-32 w-32 border-4 border-white shadow-lg bg-white">
                                <AvatarImage src={profile.photoURL} />
                                <AvatarFallback className="text-4xl font-bold text-gray-400">
                                    {profile.displayName?.charAt(0)}
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 pt-14 md:pt-12 space-y-2">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <h1 className="text-3xl font-bold text-gray-900">{profile.displayName}</h1>
                                        <div className="flex items-center gap-2 text-gray-500 mt-1">
                                            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-sm text-gray-700">
                                                {profile.wcaStyleId || profile.username || 'No ID'}
                                            </span>
                                            {profile.country && (
                                                <>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" /> {profile.country}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-4 text-center">
                                        <div className="bg-blue-50 px-4 py-2 rounded-lg">
                                            <div className="text-2xl font-bold text-blue-700">{stats.totalComps}</div>
                                            <div className="text-xs text-blue-600 font-medium uppercase">Competitions</div>
                                        </div>
                                        <div className="bg-purple-50 px-4 py-2 rounded-lg">
                                            <div className="text-2xl font-bold text-purple-700">{stats.totalEvents}</div>
                                            <div className="text-xs text-purple-600 font-medium uppercase">Events</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 text-sm text-gray-500 pt-2">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-4 w-4" /> Joined {new Date(profile.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="md:col-span-2 space-y-8">
                        {/* Personal Bests */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Trophy className="h-5 w-5 text-yellow-500" />
                                    Personal Bests
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Event</TableHead>
                                            <TableHead className="text-right">Single</TableHead>
                                            <TableHead className="text-right">Average</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.entries(stats.pbs).length > 0 ? (
                                            Object.entries(stats.pbs).map(([eventId, data]) => (
                                                <TableRow key={eventId}>
                                                    <TableCell className="font-medium flex items-center gap-2">
                                                        <EventIcon eventId={eventId} size={20} /> {getEventName(eventId)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-medium">
                                                        {formatTime(data.single)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-gray-500">
                                                        -
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                                                    No official solves yet
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Competition History */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <History className="h-5 w-5 text-gray-500" />
                                    Competition History
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {history.length > 0 ? (
                                        history.map((reg, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-4 bg-white border rounded-lg hover:border-blue-200 transition-colors">
                                                <div>
                                                    <h4 className="font-semibold text-gray-900">{reg.competitionName}</h4>
                                                    <div className="flex gap-2 mt-2">
                                                        {(reg.events || []).map(e => (
                                                            <Badge key={e} variant="secondary" className="text-xs">
                                                                {e}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <Badge variant={reg.status === 'CONFIRMED' ? 'default' : 'secondary'} className={reg.status === 'CONFIRMED' ? 'bg-green-100 text-green-700 hover:bg-green-200' : ''}>
                                                        {reg.status}
                                                    </Badge>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {new Date(reg.createdAt).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-gray-500">No competitions joined yet</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm uppercase tracking-wide text-gray-500">Badges & Achievements</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="aspect-square bg-yellow-50 rounded-lg flex flex-col items-center justify-center p-2 text-center border border-yellow-100">
                                        <Medal className="h-6 w-6 text-yellow-600 mb-1" />
                                        <span className="text-[10px] font-medium text-yellow-800">Founder</span>
                                    </div>
                                    {/* Placeholders for future badges */}
                                    <div className="aspect-square bg-gray-50 rounded-lg flex flex-col items-center justify-center p-2 text-center border border-gray-100 opacity-50">
                                        <Trophy className="h-6 w-6 text-gray-400 mb-1" />
                                        <span className="text-[10px] font-medium text-gray-500">Winner</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}