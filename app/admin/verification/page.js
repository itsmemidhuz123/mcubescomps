'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseAdmin } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { ArrowLeft, Search, Shield, ShieldCheck, ShieldAlert, Users, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { VerificationStatusBadge } from '@/components/verification/VerifiedBadge';

export default function VerificationCenterPage() {
    const { user, userProfile, isSuperAdmin, loading: authLoading } = useAuth();
    const router = useRouter();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showActionDialog, setShowActionDialog] = useState(false);
    const [actionType, setActionType] = useState(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.push('/auth/login');
            } else if (!isSuperAdmin) {
                router.push('/');
            }
        }
    }, [user, isSuperAdmin, authLoading, router]);

    useEffect(() => {
        if (user && isSuperAdmin) {
            fetchData();
        }
    }, [user, isSuperAdmin, statusFilter]);

    async function fetchData() {
        setLoading(true);
        try {
            const supabase = getSupabaseAdmin();

            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            console.log('Fetched users:', data?.length);
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching verification data:', error);
        } finally {
            setLoading(false);
        }
    }

    const filteredUsers = users.filter(u => {
        const matchesSearch = !searchQuery ||
            u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === 'ALL' || u.verification_status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const pendingUsers = filteredUsers.filter(u => u.verification_status === 'PENDING');
    const verifiedUsers = filteredUsers.filter(u => u.verification_status === 'VERIFIED');
    const rejectedUsers = filteredUsers.filter(u => u.verification_status === 'REJECTED');
    const duplicateUsers = filteredUsers.filter(u => u.duplicate_detected === true);

    async function handleAction() {
        if (!selectedUser || !actionType) return;

        setProcessing(true);
        try {
            const supabase = getSupabaseAdmin();

            if (actionType === 'force_reverify') {
                await supabase
                    .from('users')
                    .update({
                        verification_status: 'UNVERIFIED',
                        didit_session_id: null,
                        face_hash: null,
                        document_hash: null,
                        duplicate_detected: false,
                        suspicious_verification: false,
                        last_verification_result: null,
                        last_verification_attempt_at: null
                    })
                    .eq('id', selectedUser.id);
            }

            await fetchData();
            setShowActionDialog(false);
            setSelectedUser(null);
            setActionType(null);
        } catch (error) {
            console.error('Error performing action:', error);
            alert('Failed to perform action');
        } finally {
            setProcessing(false);
        }
    }

    function openActionDialog(user, action) {
        setSelectedUser(user);
        setActionType(action);
        setShowActionDialog(true);
    }

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    if (!isSuperAdmin) return null;

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8">
            <div className="container mx-auto px-4 max-w-7xl">
                <div className="mb-6">
                    <Button variant="ghost" onClick={() => router.push('/admin')} className="mb-4">
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
                    </Button>

                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                <Shield className="w-8 h-8 text-purple-500" />
                                Verification Center
                            </h1>
                            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                                Monitor and manage user identity verifications
                            </p>
                        </div>
                        <Button variant="outline" onClick={fetchData}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                                    <Users className="w-5 h-5 text-yellow-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{pendingUsers.length}</p>
                                    <p className="text-xs text-zinc-500">Pending</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                                    <ShieldCheck className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{verifiedUsers.length}</p>
                                    <p className="text-xs text-zinc-500">Verified</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                                    <ShieldAlert className="w-5 h-5 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{rejectedUsers.length}</p>
                                    <p className="text-xs text-zinc-500">Rejected</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/30">
                                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{duplicateUsers.length}</p>
                                    <p className="text-xs text-zinc-500">Duplicates</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Tabs defaultValue="all" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="all">All Users ({filteredUsers.length})</TabsTrigger>
                        <TabsTrigger value="pending">Pending ({pendingUsers.length})</TabsTrigger>
                        <TabsTrigger value="verified">Verified ({verifiedUsers.length})</TabsTrigger>
                        <TabsTrigger value="rejected">Rejected ({rejectedUsers.length})</TabsTrigger>
                        <TabsTrigger value="duplicates">Duplicates ({duplicateUsers.length})</TabsTrigger>
                    </TabsList>

                    <Card>
                        <CardHeader>
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                    <Input
                                        placeholder="Search by name or email..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-[150px]">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Status</SelectItem>
                                        <SelectItem value="PENDING">Pending</SelectItem>
                                        <SelectItem value="VERIFIED">Verified</SelectItem>
                                        <SelectItem value="REJECTED">Rejected</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>User</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Verified At</TableHead>
                                            <TableHead>Attempts</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredUsers.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-zinc-500">
                                                    No users found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredUsers.map((u) => (
                                                <TableRow key={u.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-8 w-8">
                                                                <AvatarImage src={u.picture} />
                                                                <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">
                                                                    {u.name?.[0] || 'U'}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <p className="font-medium text-zinc-900 dark:text-white">
                                                                    {u.name || 'Unknown'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                                                        {u.email}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            <VerificationStatusBadge status={u.verificationstatus -> u.verification_status} size="sm" />
                                                            {u.duplicate_detected && (
                                                                <Badge variant="outline" className="text-[10px] bg-orange-50 border-orange-200 text-orange-700">
                                                                    Duplicate
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                                                        {u.verified_at ? new Date(u.verified_at).toLocaleDateString() : 'N/A'}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                                                        {u.verification_attempt_count || 0}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {u.verificationstatus -> u.verification_status === 'VERIFIED' && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => openActionDialog(u, 'force_reverify')}
                                                                    disabled={processing}
                                                                >
                                                                    Reset
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </Tabs>

                <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Force Re-verification</DialogTitle>
                            <DialogDescription>
                                This will reset {selectedUser?.name}&apos;s verification status. They will need to verify again.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowActionDialog(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="default"
                                onClick={handleAction}
                                disabled={processing}
                            >
                                {processing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    'Reset Verification'
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}