'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
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
import { ArrowLeft, Search, Shield, Crown, UserCog, Filter, AlertTriangle, Check, X } from 'lucide-react';

const ROLES = [
    { value: 'USER', label: 'User', level: 0, description: 'Regular user with basic access' },
    { value: 'SUPPORT', label: 'Support', level: 1, description: 'Can view user profiles, payments, and add internal notes' },
    { value: 'MODERATOR', label: 'Moderator', level: 2, description: 'Can manage results, verify videos, flag suspicious users' },
    { value: 'ADMIN', label: 'Admin', level: 3, description: 'Can create competitions, manage users, view payments and audit logs' },
    { value: 'SUPER_ADMIN', label: 'Super Admin', level: 4, description: 'Full system control including role assignment' }
];

const ROLE_COLORS = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    ADMIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    MODERATOR: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    SUPPORT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    USER: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
};

export default function RoleManagementPage() {
    const { user, userProfile, isSuperAdmin, updateUserRole, loading: authLoading } = useAuth();
    const router = useRouter();

    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showRoleDialog, setShowRoleDialog] = useState(false);
    const [newRole, setNewRole] = useState('');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!authLoading) {
            if (!user) router.push('/auth/login');
            else if (!isSuperAdmin) router.push('/');
        }
    }, [user, isSuperAdmin, authLoading, router]);

    useEffect(() => {
        if (user && isSuperAdmin) fetchUsers();
    }, [user, isSuperAdmin]);

    async function fetchUsers() {
        setLoading(true);
        try {
            const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(200));
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

        setFilteredUsers(filtered);
    }, [searchQuery, roleFilter, users]);

    async function handleRoleChange() {
        if (!selectedUser || !newRole) return;

        const superAdminEmail = 'midhun.speedcuber@gmail.com';
        if (selectedUser.email?.toLowerCase() === superAdminEmail && newRole !== 'SUPER_ADMIN') {
            setError('Cannot change the Super Admin role');
            return;
        }

        setProcessing(true);
        setError('');

        try {
            await updateUserRole(selectedUser.id, newRole);

            setUsers(prev => prev.map(u => {
                if (u.id === selectedUser.id) {
                    const roleInfo = ROLES.find(r => r.value === newRole);
                    return {
                        ...u,
                        role: newRole,
                        roleLevel: roleInfo?.level || 0
                    };
                }
                return u;
            }));

            setShowRoleDialog(false);
            setSelectedUser(null);
            setNewRole('');
        } catch (error) {
            console.error('Error updating role:', error);
            setError(error.message || 'Failed to update role');
        } finally {
            setProcessing(false);
        }
    }

    const openRoleDialog = (u) => {
        setSelectedUser(u);
        setNewRole(u.role || 'USER');
        setError('');
        setShowRoleDialog(true);
    };

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

                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <Crown className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Role Management</h1>
                            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                                Assign and manage user roles. Only Super Admin can access this page.
                            </p>
                        </div>
                    </div>
                </div>

                <Card className="mb-6 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                            <div className="text-sm text-yellow-800 dark:text-yellow-200">
                                <p className="font-medium">Important</p>
                                <p>Role changes take effect immediately. Be careful when assigning Admin or Super Admin roles.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

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
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filter by role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Roles</SelectItem>
                                    {ROLES.map(role => (
                                        <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                                    ))}
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
                                        <TableHead>Current Role</TableHead>
                                        <TableHead>Role Level</TableHead>
                                        <TableHead>Last Login</TableHead>
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
                                                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                                        Level {u.roleLevel ?? ROLES.find(r => r.value === u.role)?.level ?? 0}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                                                    {u.lastLoginAt ? new Date(u.lastLoginAt.toDate?.() || u.lastLoginAt).toLocaleDateString() : 'Never'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => openRoleDialog(u)}
                                                        disabled={u.email?.toLowerCase() === 'midhu.speedcuber@gmail.com' && u.role === 'SUPER_ADMIN'}
                                                    >
                                                        <UserCog className="h-4 w-4 mr-1" /> Change Role
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Change User Role</DialogTitle>
                            <DialogDescription>
                                Select a new role for {selectedUser?.displayName || selectedUser?.email}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Select New Role</label>
                                <Select value={newRole} onValueChange={setNewRole}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ROLES.map(role => (
                                            <SelectItem key={role.value} value={role.value}>
                                                <div className="flex flex-col">
                                                    <span>{role.label}</span>
                                                    <span className="text-xs text-zinc-500">{role.description}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {newRole && (
                                <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                                    <p className="text-sm font-medium mb-2">Role Permissions:</p>
                                    <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                                        {(() => {
                                            const role = ROLES.find(r => r.value === newRole);
                                            if (newRole === 'SUPER_ADMIN') {
                                                return <li>Full system access including role assignment</li>;
                                            } else if (newRole === 'ADMIN') {
                                                return (
                                                    <>
                                                        <li>Create and manage competitions</li>
                                                        <li>Manage users and suspend accounts</li>
                                                        <li>View payments and audit logs</li>
                                                        <li>Cannot assign roles or delete competitions</li>
                                                    </>
                                                );
                                            } else if (newRole === 'MODERATOR') {
                                                return (
                                                    <>
                                                        <li>Manage results and verify videos</li>
                                                        <li>Flag suspicious users</li>
                                                        <li>Cannot create competitions or access payments</li>
                                                    </>
                                                );
                                            } else if (newRole === 'SUPPORT') {
                                                return (
                                                    <>
                                                        <li>View user profiles and payments</li>
                                                        <li>Add internal notes</li>
                                                        <li>Cannot modify data or access admin settings</li>
                                                    </>
                                                );
                                            }
                                            return <li>Basic user access</li>;
                                        })()}
                                    </ul>
                                </div>
                            )}

                            {error && (
                                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleRoleChange}
                                disabled={!newRole || processing || newRole === selectedUser?.role}
                            >
                                {processing ? 'Updating...' : 'Update Role'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}