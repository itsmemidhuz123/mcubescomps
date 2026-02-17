'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, limit, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, FileDown, Trophy, Users, DollarSign, Trash2, Ban, ShieldCheck, Clock, Timer, AlertTriangle, Eye, Gavel, CheckCircle } from 'lucide-react';
import { WCA_EVENTS, getEventName } from '@/lib/wcaEvents';

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
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  
  // Data States
  const [competitions, setCompetitions] = useState([]);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [flaggedSolves, setFlaggedSolves] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalRevenue: 0,
    activeCompetitions: 0
  });
  const [loadingData, setLoadingData] = useState(true);

  // Form States
  const [editingComp, setEditingComp] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
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
    isPublished: false
  });

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

      // Fetch Flagged Solves from all competitions
      const flaggedResults = [];
      const fetchPromises = compsData.map(async (comp) => {
        try {
          const q = query(collection(db, 'competitions', comp.id, 'results'), where('flagged', '==', true));
          const snap = await getDocs(q);
          snap.forEach(doc => {
            flaggedResults.push({
              id: doc.id,
              ...doc.data(),
              competitionId: comp.id,
              competitionName: comp.name,
              path: `competitions/${comp.id}/results/${doc.id}`
            });
          });
        } catch (e) {
          console.error(`Error fetching results for ${comp.id}`, e);
        }
      });
      await Promise.all(fetchPromises);
      // Sort by date desc
      flaggedResults.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setFlaggedSolves(flaggedResults);

      const totalRevenue = paymentsData
        .filter(p => p.status === 'SUCCESS')
        .reduce((sum, p) => {
          const amount = parseFloat(p.amount) || 0;
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

  const handleResolveFlag = async (solve, action) => {
    if (!confirm(`Are you sure you want to ${action} this solve?`)) return;

    try {
      const solveRef = doc(db, solve.path);
      
      if (action === 'approve') {
        // Remove flag, keep time
        await updateDoc(solveRef, {
          flagged: false,
          flagResolved: true,
          flagResolution: 'Approved by Admin'
        });
      } else if (action === 'dnf') {
        // Keep flag record but mark as DNF
        await updateDoc(solveRef, {
          time: -1, // DNF
          penalty: 'DNF',
          flagResolved: true,
          flagResolution: 'DNF by Admin'
        });
      } else if (action === 'delete') {
        await deleteDoc(solveRef);
      }

      // Add audit log
      await addDoc(collection(db, 'auditLogs'), {
        action: `SOLVE_${action.toUpperCase()}`,
        adminId: user.uid,
        adminEmail: user.email,
        solveId: solve.id,
        userEmail: solve.userEmail,
        timestamp: new Date().toISOString()
      });

      alert('Action completed');
      fetchData(); // Refresh
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleExportFlags = () => {
    if (!flaggedSolves.length) return alert('No flagged solves to export');
    
    const headers = ['ID', 'User', 'Competition', 'Event', 'Time', 'Flag Reason', 'Violations', 'IP', 'Device', 'Date'];
    const rows = flaggedSolves.map(s => [
      s.id,
      s.userName || s.userEmail,
      s.competitionName,
      s.eventId,
      s.time,
      s.flagReason,
      JSON.stringify(s.violations || {}),
      s.ipAddress || 'N/A',
      JSON.stringify(s.deviceInfo || {}),
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

  const resetForm = () => {
    setFormData({
      name: '',
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
      isPublished: false
    });
    setEditingComp(null);
  };

  const loadCompForEdit = (comp) => {
    setEditingComp(comp);
    setFormData({
      name: comp.name || '',
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
      isPublished: comp.isPublished || false
    });
  };

  const handleCompSubmit = async (e) => {
    e.preventDefault();
    if (formData.selectedEvents.length === 0) {
      alert('Please select at least one event');
      return;
    }

    try {
      const compData = {
        name: formData.name,
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
        updatedAt: new Date().toISOString()
      };

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
    
    const headers = ['Date', 'Competition', 'User', 'Amount', 'Currency', 'Status'];
    const rows = payments.map(p => [
      new Date(p.createdAt).toLocaleDateString(),
      getCompetitionName(p.competitionId),
      p.userEmail,
      p.amount,
      p.currency,
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

  if (authLoading || loadingData) return <div className="p-8 text-center">Loading Admin Panel...</div>;
  if (!isAdmin) return null;

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <Button variant="outline" onClick={fetchData}><RefreshCw className="w-4 h-4 mr-2"/> Refresh Data</Button>
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
          <TabsTrigger value="payments">Payments</TabsTrigger>
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
                              {solve.penalty === 'DNF' ? 'DNF' : (solve.time / 1000).toFixed(2) + 's'}
                            </div>
                            <div className="text-xs text-gray-400">
                              {new Date(solve.createdAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[250px]">
                            <div className="space-y-1">
                              <Badge variant="destructive" className="mb-1">{solve.flagReason}</Badge>
                              <div className="text-xs grid grid-cols-2 gap-1">
                                {solve.violations?.tabSwitch && <span className="text-red-500">• Tab Switch</span>}
                                {solve.violations?.windowBlur && <span className="text-red-500">• Window Blur</span>}
                                {solve.violations?.multiTab && <span className="text-red-500">• Multi-Tab</span>}
                                {solve.violations?.rightClick && <span className="text-red-500">• Right Click</span>}
                                {solve.violations?.devTools && <span className="text-red-500">• DevTools</span>}
                                {solve.violations?.suspiciousTime && <span className="text-red-500">• Suspicious Time</span>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-1">
                              <div><span className="font-semibold">IP:</span> {solve.ipAddress || 'N/A'}</div>
                              <div><span className="font-semibold">Loc:</span> {solve.city}, {solve.country}</div>
                              {solve.anomalyScore > 0 && (
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                  Score: {solve.anomalyScore}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
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
                                className="text-orange-600 hover:bg-orange-50 border-orange-200"
                                onClick={() => handleResolveFlag(solve, 'dnf')}
                                title="Penalty (DNF)"
                              >
                                <Gavel className="h-4 w-4" />
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
                    <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                  </div>
                  
                  <div className="space-y-4 border p-4 rounded-md bg-blue-50/50">
                    <h3 className="font-semibold text-blue-900">Competition Period (When users can solve)</h3>
                    <div className="space-y-2">
                      <Label>Start Date & Time</Label>
                      <Input type="datetime-local" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date & Time</Label>
                      <Input type="datetime-local" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} required />
                    </div>
                  </div>

                  <div className="space-y-4 border p-4 rounded-md bg-green-50/50">
                    <h3 className="font-semibold text-green-900">Registration Period (When users can signup)</h3>
                    <div className="space-y-2">
                      <Label>Registration Opens</Label>
                      <Input type="datetime-local" value={formData.registrationStartDate} onChange={e => setFormData({...formData, registrationStartDate: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Registration Closes</Label>
                      <Input type="datetime-local" value={formData.registrationEndDate} onChange={e => setFormData({...formData, registrationEndDate: e.target.value})} required />
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
                        onValueChange={val => setFormData({...formData, type: val})}
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
                         <Select value={formData.currency} onValueChange={val => setFormData({...formData, currency: val})}>
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
                        <Input type="number" value={formData.flatPrice} onChange={e => setFormData({...formData, flatPrice: e.target.value})} required />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Solve Limit (AoX)</Label>
                  <Input type="number" value={formData.solveLimit} onChange={e => setFormData({...formData, solveLimit: e.target.value})} required />
                </div>

                <div className="flex items-center space-x-2 border p-4 rounded-md">
                  <Switch 
                    id="published" 
                    checked={formData.isPublished}
                    onCheckedChange={(checked) => setFormData({...formData, isPublished: checked})}
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
                    <Label className="text-lg">Scrambles (5 per event required)</Label>
                    {formData.selectedEvents.map(eventId => (
                      <Card key={eventId} className="bg-slate-50 dark:bg-slate-900">
                        <CardHeader className="py-2">
                          <CardTitle className="text-sm">{getEventName(eventId)}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {[0, 1, 2, 3, 4].map(i => (
                            <Input 
                              key={i}
                              placeholder={`Scramble ${i + 1}`}
                              value={formData.scrambles[eventId]?.[i] || ''}
                              onChange={(e) => handleScrambleChange(eventId, i, e.target.value)}
                              className="font-mono text-xs"
                            />
                          ))}
                        </CardContent>
                      </Card>
                    ))}
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
                    <TableCell>{comp.events?.length || 0} Events</TableCell>
                    <TableCell>
                      {comp.isPublished ? <Badge className="bg-green-600">Published</Badge> : <Badge variant="outline">Draft</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => loadCompForEdit(comp)}>Edit</Button>
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
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium text-blue-600">{getCompetitionName(p.competitionId)}</TableCell>
                      <TableCell>{p.userEmail}</TableCell>
                      <TableCell className="font-mono">{p.currency} {p.amount}</TableCell>
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
      </Tabs>
    </div>
  );
}