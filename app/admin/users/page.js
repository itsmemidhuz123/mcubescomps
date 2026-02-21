'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, query, orderBy, limit, startAfter, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { ArrowLeft, Search, Users, Ban, CheckCircle, Shield, Crown, UserCheck, UserX, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

const ROLE_LEVELS = {
    USER: 0,
    SUPPORT: 1,
    MODERATOR: 2,
    ADMIN: 3,
    SUPER_ADMIN: 4
};

const ROLE_COLORS = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    ADMIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    MODERATOR: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    SUPPORT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    USER: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
};

const STATUS_COLORS = {
    ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    SUSPENDED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
};

export default function UserManagementPage() {
    const { user, userProfile, isAdmin, isSuperAdmin, loading: authLoading } = useAuth();
    const router = useRouter();

    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showSuspendDialog, setShowSuspendDialog] = useState(false);
    const [suspendReason, setSuspendReason] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!authLoading) {
            if (!user) router.push('/auth/login');
            else if (!isAdmin) router.push('/');
        }
    }, [user, isAdmin, authLoading, router]);

    useEffect(() => {
        if (user && isAdmin) fetchUsers();
    }, [user, isAdmin]);

    async function fetchUsers() {
        setLoading(true);
        try {
            const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100));
            const snapshot = await getDocs(usersQuery);
            const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(usersData);
            setFilteredUsers(usersData);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        let filtered = users;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(u =>
                u.displayName?.toLowerCase().includes(query) ||
                u.email?.toLowerCase().includes(query) ||
                u.wcaStyleId?.toLowerCase().includes(query)
            );
        }

        if (roleFilter !== 'ALL') {
            filtered = filtered.filter(u => u.role === roleFilter);
        }

        if (statusFilter !== 'ALL') {
            filtered = filtered.filter(u => u.status === statusFilter);
        }

        setFilteredUsers(filtered);
    }, [searchQuery, roleFilter, statusFilter, users]);

    async function handleSuspendUser() {
        if (!selectedUser || !suspendReason) return;

        setProcessing(true);
        try {
            await updateDoc(doc(db, 'users', selectedUser.id), {
                status: 'SUSPENDED',
                suspendedAt: serverTimestamp(),
                suspendedBy: user.uid,
                suspendReason: suspendReason
            });

            setUsers(prev => prev.map(u =>
                u.id === selectedUser.id ? { ...u, status: 'SUSPENDED', suspendReason } : u
            ));

            setShowSuspendDialog(false);
            setSelectedUser(null);
            setSuspendReason('');
        } catch (error) {
            console.error('Error suspending user:', error);
            alert('Failed to suspend user');
        } finally {
            setProcessing(false);
        }
    }

    async function handleActivateUser(userToActivate) {
        setProcessing(true);
        try {
            await updateDoc(doc(db, 'users', userToActivate.id), {
                status: 'ACTIVE',
                suspendedAt: null,
                suspendedBy: null,
                suspendReason: null
            });

            setUsers(prev => prev.map(u =>
                u.id === userToActivate.id ? { ...u, status: 'ACTIVE' } : u
            ));
        } catch (error) {
            console.error('Error activating user:', error);
            alert('Failed to activate user');
        } finally {
            setProcessing(false);
        }
    }

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8">
            <div className="container mx-auto px-4 max-w-7xl">
                <div className="mb-6">
                    <Button variant="ghost" onClick={() => router.push('/admin')} className="mb-4">
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
                    </Button>

                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">User Management</h1>
                            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                                Manage users, suspend accounts, and view user details
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-zinc-500">
                            <Users className="h-4 w-4" />
                            {filteredUsers.length} of {users.length} users
                        </div>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                <Input
                                    placeholder="Search by name, email, or WCA ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Roles</SelectItem>
                                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                                    <SelectItem value="ADMIN">Admin</SelectItem>
                                    <SelectItem value="MODERATOR">Moderator</SelectItem>
                                    <SelectItem value="SUPPORT">Support</SelectItem>
                                    <SelectItem value="USER">User</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Status</SelectItem>
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
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
                                        <TableHead>Role</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Country</TableHead>
                                        <TableHead>Joined</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-zinc-500">
                                                No users found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredUsers.map((u) => (
                                            <TableRow key={u.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={u.photoURL} />
                                                            <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">
                                                                {u.displayName?.[0] || 'U'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium text-zinc-900 dark:text-white">
                                                                {u.displayName || 'Unknown'}
                                                            </p>
                                                            <p className="text-xs text-zinc-500">{u.wcaStyleId}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                                                    {u.email}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={ROLE_COLORS[u.role] || ROLE_COLORS.USER}>
                                                        {u.role === 'SUPER_ADMIN' && <Crown className="h-3 w-3 mr-1" />}
                                                        {u.role === 'ADMIN' && <Shield className="h-3 w-3 mr-1" />}
                                                        {u.role || 'USER'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={STATUS_COLORS[u.status] || STATUS_COLORS.ACTIVE}>
                                                        {u.status || 'ACTIVE'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                                                    {u.country || 'Unknown'}
                                                </TableCell>
                                                <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                                                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {u.status === 'SUSPENDED' ? (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleActivateUser(u)}
                                                                disabled={processing}
                                                            >
                                                                <UserCheck className="h-4 w-4 mr-1" /> Activate
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-red-600 hover:text-red-700"
                                                                onClick={() => {
                                                                    setSelectedUser(u);
                                                                    setShowSuspendDialog(true);
                                                                }}
                                                                disabled={processing || u.role === 'SUPER_ADMIN'}
                                                            >
                                                                <Ban className="h-4 w-4 mr-1" /> Suspend
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

                <Dialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Suspend User</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to suspend {selectedUser?.displayName}? They will be immediately logged out and unable to access the platform.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <label className="text-sm font-medium">Reason for suspension</label>
                            <Input
                                placeholder="Enter reason..."
                                value={suspendReason}
                                onChange={(e) => setSuspendReason(e.target.value)}
                                className="mt-2"
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowSuspendDialog(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleSuspendUser}
                                disabled={!suspendReason || processing}
                            >
                                {processing ? 'Suspending...' : 'Suspend User'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}