'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where, getDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Shield, Users, Trophy, Edit, Eye, CreditCard, Download, EyeOff, Search, FileDown, AlertTriangle, Gavel, RefreshCw, X, DollarSign, Activity, FileText } from 'lucide-react';
import { WCA_EVENTS, getEventName } from '@/lib/wcaEvents';
import { toast } from "sonner"; // Assuming sonner or use-toast is available, fallback to alert if not

function AdminPanel() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  
  // Data States
  const [competitions, setCompetitions] = useState([]);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [solves, setSolves] = useState([]); // For Solve Management
  const [auditLogs, setAuditLogs] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSolves: 0,
    totalRevenue: 0,
    activeCompetitions: 0
  });
  const [loadingData, setLoadingData] = useState(true);

  // Filter States
  const [userSearch, setUserSearch] = useState('');
  const [solveSearchComp, setSolveSearchComp] = useState('');
  const [solveSearchUser, setSolveSearchUser] = useState('');

  // Editing States
  const [editingComp, setEditingComp] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editingSolve, setEditingSolve] = useState(null);

  // Form States
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    registrationOpenDate: '',
    registrationCloseDate: '',
    competitionStartDate: '',
    competitionEndDate: '',
    type: 'FREE',
    pricingModel: 'flat',
    flatPrice: 0,
    basePrice: 0,
    perEventPrice: 0,
    currency: 'INR',
    solveLimit: 5,
    selectedEvents: [],
    scrambles: {},
    published: true
  });

  // Load Data
  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
    if (!authLoading && user && !isAdmin) router.push('/');
  }, [user, isAdmin, authLoading, router]);

  useEffect(() => {
    if (user && isAdmin) fetchData();
  }, [user, isAdmin]);

  async function fetchData() {
    setLoadingData(true);
    try {
      // Fetch Competitions
      const compsSnapshot = await getDocs(collection(db, 'competitions'));
      const compsData = compsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      compsData.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setCompetitions(compsData);

      // Fetch Users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);

      // Fetch Payments
      const paymentsSnapshot = await getDocs(collection(db, 'payments'));
      const paymentsData = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPayments(paymentsData);

      // Fetch Audit Logs (Limit 50)
      const auditQuery = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(50));
      const auditSnapshot = await getDocs(auditQuery);
      setAuditLogs(auditSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Calculate Stats
      const totalRevenue = paymentsData
        .filter(p => p.status === 'SUCCESS')
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        
      // Fetch total solves count (approximate or separate query)
      // For accurate "Total Solves", we might need a separate aggregation or count query
      // For now, we'll estimate or leave if too expensive. Let's do a simple count query.
      const solvesCountSnapshot = await getDocs(query(collection(db, 'solves'), limit(1))); // Just checking existence? No, need count. 
      // Firestore count is cheaper but requires server module or full read. 
      // Let's assume we can display "N/A" or fetch all solves if not too many. 
      // Better approach: Admin usually manages solves per competition. Global count might be heavy.
      // Let's rely on competition participant counts or similar if available.
      
      setStats({
        totalUsers: usersData.length,
        totalRevenue,
        activeCompetitions: compsData.filter(c => c.status === 'UPCOMING' || c.status === 'LIVE').length,
        totalSolves: 'See Details' // Placeholder to avoid massive read
      });
      
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoadingData(false);
    }
  }

  // --- LOGGING ---
  const logAction = async (action, details) => {
    try {
      await addDoc(collection(db, 'auditLogs'), {
        action,
        adminId: user.uid,
        adminName: user.email,
        details,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error('Audit log failed', e);
    }
  };

  // --- COMPETITION MANAGEMENT ---

  const handleCompSubmit = async (e) => {
    e.preventDefault();
    if (formData.selectedEvents.length === 0) return alert('Select at least one event');
    
    // Scramble validation
    for (const eventId of formData.selectedEvents) {
      const scrambles = formData.scrambles[eventId];
      if (!scrambles || scrambles.some(s => !s?.trim())) return alert(`Enter all scrambles for ${getEventName(eventId)}`);
    }

    const compData = {
      ...formData,
      flatPrice: parseFloat(formData.flatPrice) || 0,
      basePrice: parseFloat(formData.basePrice) || 0,
      perEventPrice: parseFloat(formData.perEventPrice) || 0,
      solveLimit: parseInt(formData.solveLimit),
      events: formData.selectedEvents,
      updatedAt: new Date().toISOString(),
      startDate: formData.competitionStartDate, // Legacy support
      endDate: formData.competitionEndDate,     // Legacy support
    };

    try {
      if (editingComp) {
        await updateDoc(doc(db, 'competitions', editingComp.id), compData);
        logAction('UPDATE_COMPETITION', { compId: editingComp.id, name: compData.name });
      } else {
        compData.createdAt = new Date().toISOString();
        compData.participantCount = 0;
        const docRef = await addDoc(collection(db, 'competitions'), compData);
        logAction('CREATE_COMPETITION', { compId: docRef.id, name: compData.name });
      }
      fetchData();
      resetForm();
      alert(editingComp ? 'Competition updated' : 'Competition created');
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', description: '', registrationOpenDate: '', registrationCloseDate: '',
      competitionStartDate: '', competitionEndDate: '', type: 'FREE', pricingModel: 'flat',
      flatPrice: 0, basePrice: 0, perEventPrice: 0, currency: 'INR', solveLimit: 5,
      selectedEvents: [], scrambles: {}, published: true
    });
    setEditingComp(null);
  };

  const handleEditComp = (comp) => {
    setEditingComp(comp);
    const scrambles = {};
    if (comp.events) {
      comp.events.forEach(eventId => {
        scrambles[eventId] = comp.scrambles?.[eventId] || Array(comp.solveLimit || 5).fill('');
      });
    }
    setFormData({
      name: comp.name || '',
      description: comp.description || '',
      registrationOpenDate: comp.registrationOpenDate || '',
      registrationCloseDate: comp.registrationCloseDate || '',
      competitionStartDate: comp.competitionStartDate || '',
      competitionEndDate: comp.competitionEndDate || '',
      type: comp.type || 'FREE',
      pricingModel: comp.pricingModel || 'flat',
      flatPrice: comp.flatPrice || 0,
      basePrice: comp.basePrice || 0,
      perEventPrice: comp.perEventPrice || 0,
      currency: comp.currency || 'INR',
      solveLimit: comp.solveLimit || 5,
      selectedEvents: comp.events || [],
      scrambles: scrambles,
      published: comp.published !== false
    });
  };

  const handleEventToggle = (eventId) => {
    const selected = formData.selectedEvents.includes(eventId);
    if (selected) {
      setFormData({
        ...formData,
        selectedEvents: formData.selectedEvents.filter(e => e !== eventId),
        scrambles: { ...formData.scrambles, [eventId]: undefined }
      });
    } else {
      setFormData({
        ...formData,
        selectedEvents: [...formData.selectedEvents, eventId],
        scrambles: { ...formData.scrambles, [eventId]: Array(formData.solveLimit).fill('') }
      });
    }
  };

  const handleScrambleChange = (eventId, index, value) => {
    const newScrambles = { ...formData.scrambles };
    if (!newScrambles[eventId]) newScrambles[eventId] = Array(formData.solveLimit).fill('');
    newScrambles[eventId][index] = value;
    setFormData({ ...formData, scrambles: newScrambles });
  };

  // --- CSV DOWNLOAD ---

  const downloadRegistrationsCSV = async (comp) => {
    try {
      // 1. Fetch Registrations
      const regsQuery = query(collection(db, 'registrations'), where('competitionId', '==', comp.id));
      const regsSnapshot = await getDocs(regsQuery);
      
      // 2. Fetch Payments
      const paymentsQuery = query(collection(db, 'payments'), where('competitionId', '==', comp.id));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const paymentsMap = {}; // userId -> payment details
      paymentsSnapshot.forEach(doc => {
        const p = doc.data();
        if (p.status === 'SUCCESS') paymentsMap[p.userId] = p;
      });

      // 3. Prepare CSV Data
      let csv = 'Name,Email,WCA ID,Events Registered,Payment Status,Amount,Registration Date\n';
      
      for (const regDoc of regsSnapshot.docs) {
        const reg = regDoc.data();
        let user = users.find(u => u.id === reg.userId) || {};
        
        // If user not in state (rare), try fetch or use reg data
        const payment = paymentsMap[reg.userId];
        
        const row = [
          `"${user.displayName || reg.userName || 'Unknown'}"`,
          `"${user.email || 'N/A'}"`,
          `"${user.wcaStyleId || reg.wcaStyleId || 'N/A'}"`,
          `"${(reg.events || []).map(id => getEventName(id)).join('; ')}"`,
          comp.type === 'FREE' ? 'FREE' : (payment ? 'PAID' : 'PENDING'),
          payment ? `${payment.currency} ${payment.amount}` : '0',
          `"${new Date(reg.createdAt).toLocaleDateString()}"`
        ];
        
        csv += row.join(',') + '\n';
      }

      // Download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${comp.name.replace(/[^a-z0-9]/gi, '_')}_registrations.csv`;
      link.click();
    } catch (e) {
      alert('Failed to generate CSV: ' + e.message);
    }
  };

  // --- USER MANAGEMENT ---

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      await updateDoc(doc(db, 'users', editingUser.id), {
        displayName: editingUser.displayName,
        username: editingUser.username,
        country: editingUser.country,
        role: editingUser.role,
        status: editingUser.status,
        wcaStyleId: editingUser.wcaStyleId
      });
      
      logAction('UPDATE_USER', { 
        userId: editingUser.id, 
        updates: { role: editingUser.role, status: editingUser.status } 
      });

      fetchData();
      setEditingUser(null);
      alert('User updated successfully');
    } catch (e) {
      alert('Failed to update user: ' + e.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      logAction('DELETE_USER', { userId });
      fetchData();
    } catch (e) {
      alert('Failed to delete user: ' + e.message);
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.wcaStyleId?.toLowerCase().includes(userSearch.toLowerCase())
  );

  // --- SOLVE MANAGEMENT ---

  const fetchSolves = async () => {
    if (!solveSearchComp) return;
    setLoadingData(true);
    try {
      let q = query(collection(db, 'results'), where('competitionId', '==', solveSearchComp));
      const snapshot = await getDocs(q);
      let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (solveSearchUser) {
        const searchLower = solveSearchUser.toLowerCase();
        results = results.filter(r => 
          r.userName?.toLowerCase().includes(searchLower) ||
          r.wcaStyleId?.toLowerCase().includes(searchLower)
        );
      }
      
      // Sort by date desc
      results.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setSolves(results);
    } catch (e) {
      alert('Failed to fetch solves: ' + e.message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleUpdateSolve = async () => {
    if (!editingSolve) return;
    try {
      const updateData = {
        penalty: editingSolve.penalty,
        editedByAdmin: true,
        flagged: editingSolve.flagged || false,
        flagReason: editingSolve.flagReason || '',
        updatedAt: new Date().toISOString()
      };
      
      await updateDoc(doc(db, 'results', editingSolve.id), updateData);
      
      // Log audit (using helper)
      logAction('UPDATE_SOLVE', { solveId: editingSolve.id, changes: updateData });

      setEditingSolve(null);
      fetchSolves(); // Refresh
      alert('Solve updated');
    } catch (e) {
      alert('Update failed: ' + e.message);
    }
  };

  const handleDeleteSolve = async (solveId) => {
    if (!confirm('Delete this solve?')) return;
    try {
      await deleteDoc(doc(db, 'results', solveId));
      logAction('DELETE_SOLVE', { solveId });
      fetchSolves();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  const downloadPaymentsCSV = () => {
    const csv = [
      ['Date', 'User', 'Competition', 'Amount', 'Currency', 'Status', 'Transaction ID'].join(','),
      ...payments.map(p => [
        `"${new Date(p.createdAt).toLocaleDateString()}"`,
        `"${users.find(u => u.id === p.userId)?.displayName || 'Unknown'}"`,
        `"${competitions.find(c => c.id === p.competitionId)?.name || 'Unknown'}"`,
        p.amount,
        p.currency,
        p.status,
        `"${p.id}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payments_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };


  if (authLoading) return <div className="p-8 text-center">Loading Admin...</div>;
  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-gray-500">Platform management and configuration</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/')}>Exit Admin</Button>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="bg-white p-1 border shadow-sm flex-wrap h-auto">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="create" onClick={() => { setEditingComp(null); resetForm(); }}>Create Comp</TabsTrigger>
            <TabsTrigger value="manage">Manage Comps</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="solves">Solve Management</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>

          {/* DASHBOARD TAB */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                  <div className="text-2xl font-bold">+{stats.totalUsers}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Events</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeCompetitions}</div>
                </CardContent>
              </Card>
            </div>

            {/* Audit Log Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Audit Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                   {auditLogs.length === 0 ? <p className="text-sm text-gray-500">No logs found</p> : 
                    auditLogs.map(log => (
                      <div key={log.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                         <div>
                            <p className="font-medium text-sm">{log.action}</p>
                            <p className="text-xs text-gray-500">{log.adminName}</p>
                         </div>
                         <div className="text-xs text-gray-400">
                            {new Date(log.timestamp).toLocaleString()}
                         </div>
                      </div>
                    ))
                   }
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PAYMENTS TAB */}
          <TabsContent value="payments">
            <Card>
               <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Payment Reconciliation</CardTitle>
                    <CardDescription>View and export all transactions</CardDescription>
                  </div>
                  <Button variant="outline" onClick={downloadPaymentsCSV}>
                     <Download className="w-4 h-4 mr-2" /> Export CSV
                  </Button>
               </CardHeader>
               <CardContent>
                  <Table>
                     <TableHeader>
                        <TableRow>
                           <TableHead>Date</TableHead>
                           <TableHead>User</TableHead>
                           <TableHead>Amount</TableHead>
                           <TableHead>Competition</TableHead>
                           <TableHead>Status</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {payments.length === 0 ? (
                           <TableRow><TableCell colSpan={5} className="text-center">No payments found</TableCell></TableRow>
                        ) : payments.map(p => (
                           <TableRow key={p.id}>
                              <TableCell>{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                              <TableCell>{users.find(u => u.id === p.userId)?.displayName || 'Unknown'}</TableCell>
                              <TableCell>{p.currency} {p.amount}</TableCell>
                              <TableCell>{competitions.find(c => c.id === p.competitionId)?.name || 'Unknown'}</TableCell>
                              <TableCell>
                                 <Badge variant={p.status === 'SUCCESS' ? 'default' : 'secondary'}>{p.status}</Badge>
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </CardContent>
            </Card>
          </TabsContent>

          {/* CREATE / EDIT COMP */}
          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>{editingComp ? 'Edit Competition' : 'Create New Competition'}</CardTitle>
                <CardDescription>Configure events, pricing, and schedule</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCompSubmit} className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label>Name</Label>
                      <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Description</Label>
                      <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                    </div>
                    
                    {/* Dates */}
                    <div className="space-y-2">
                       <Label>Registration Start</Label>
                       <Input type="datetime-local" value={formData.registrationOpenDate} onChange={e => setFormData({...formData, registrationOpenDate: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                       <Label>Registration End</Label>
                       <Input type="datetime-local" value={formData.registrationCloseDate} onChange={e => setFormData({...formData, registrationCloseDate: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                       <Label>Competition Start</Label>
                       <Input type="datetime-local" value={formData.competitionStartDate} onChange={e => setFormData({...formData, competitionStartDate: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                       <Label>Competition End</Label>
                       <Input type="datetime-local" value={formData.competitionEndDate} onChange={e => setFormData({...formData, competitionEndDate: e.target.value})} required />
                    </div>
                  </div>

                  {/* Settings */}
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={formData.type} onValueChange={v => setFormData({...formData, type: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="FREE">Free</SelectItem><SelectItem value="PAID">Paid</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Solve Limit (AoX)</Label>
                      <Input type="number" value={formData.solveLimit} onChange={e => setFormData({...formData, solveLimit: e.target.value})} />
                    </div>
                    <div className="flex items-center space-x-2 pt-8">
                       <Switch checked={formData.published} onCheckedChange={c => setFormData({...formData, published: c})} />
                       <Label>Published (Visible to users)</Label>
                    </div>
                  </div>

                  {/* Events */}
                  <div className="space-y-3">
                    <Label className="font-semibold">Events</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {WCA_EVENTS.map(ev => (
                        <div key={ev.id} className="flex items-center space-x-2">
                          <Checkbox checked={formData.selectedEvents.includes(ev.id)} onCheckedChange={() => handleEventToggle(ev.id)} />
                          <span>{ev.icon} {ev.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Scrambles */}
                  {formData.selectedEvents.map(evId => (
                    <div key={evId} className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <Label className="font-semibold">{getEventName(evId)} Scrambles ({formData.solveLimit})</Label>
                      {Array.from({length: formData.solveLimit}).map((_, i) => (
                        <Input 
                          key={i} 
                          placeholder={`Scramble ${i+1}`} 
                          value={formData.scrambles[evId]?.[i] || ''} 
                          onChange={e => handleScrambleChange(evId, i, e.target.value)}
                          className="font-mono text-xs"
                        />
                      ))}
                    </div>
                  ))}

                  <div className="flex gap-4">
                    <Button type="submit" size="lg" className="flex-1">{editingComp ? 'Update' : 'Create'} Competition</Button>
                    {editingComp && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MANAGE COMPETITIONS */}
          <TabsContent value="manage">
            <div className="grid gap-4">
              {competitions.map(comp => (
                <Card key={comp.id}>
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                         <h3 className="font-bold text-lg">{comp.name}</h3>
                         {!comp.published && <Badge variant="secondary">Draft</Badge>}
                         <Badge>{comp.type}</Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        {new Date(comp.competitionStartDate || comp.startDate).toLocaleDateString()} • {comp.events?.length} Events
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEditComp(comp)}>
                        <Edit className="w-4 h-4 mr-2" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => downloadRegistrationsCSV(comp)}>
                        <FileDown className="w-4 h-4 mr-2" /> CSV
                      </Button>
                      <Button size="sm" variant="destructive" onClick={async () => {
                         if(confirm('Delete competition?')) { await deleteDoc(doc(db, 'competitions', comp.id)); fetchData(); }
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* USER MANAGEMENT */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                   <CardTitle>User Database ({users.length})</CardTitle>
                   <div className="w-64 relative">
                     <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                     <Input placeholder="Search users..." className="pl-8" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                   </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>WCA ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map(u => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="font-medium">{u.displayName}</div>
                          <div className="text-xs text-gray-500">{u.email}</div>
                        </TableCell>
                        <TableCell>{u.wcaStyleId || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={u.role === 'ADMIN' ? 'default' : 'outline'}>{u.role || 'USER'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.status === 'SUSPENDED' ? 'destructive' : 'secondary'}>{u.status || 'ACTIVE'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Dialog open={editingUser?.id === u.id} onOpenChange={(open) => !open && setEditingUser(null)}>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="ghost" onClick={() => setEditingUser(u)}><Edit className="h-4 w-4" /></Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Display Name</Label>
                                      <Input value={editingUser?.displayName || ''} onChange={e => setEditingUser({...editingUser, displayName: e.target.value})} />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Country</Label>
                                      <Input value={editingUser?.country || ''} onChange={e => setEditingUser({...editingUser, country: e.target.value})} />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Role</Label>
                                      <Select value={editingUser?.role || 'USER'} onValueChange={v => setEditingUser({...editingUser, role: v})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="USER">User</SelectItem><SelectItem value="ADMIN">Admin</SelectItem></SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Status</Label>
                                      <Select value={editingUser?.status || 'ACTIVE'} onValueChange={v => setEditingUser({...editingUser, status: v})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="SUSPENDED">Suspended</SelectItem></SelectContent>
                                      </Select>
                                    </div>
                                    <div className="col-span-2 space-y-2 border-t pt-4">
                                       <Label>Advanced</Label>
                                       <div className="flex items-center justify-between">
                                         <span className="text-sm">WCA ID Lock</span>
                                         <Button type="button" variant="outline" size="sm" onClick={() => setEditingUser({...editingUser, wcaStyleId: ''})}>Reset WCA ID</Button>
                                       </div>
                                    </div>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button onClick={handleUpdateUser}>Save Changes</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeleteUser(u.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SOLVE MANAGEMENT */}
          <TabsContent value="solves">
            <Card>
              <CardHeader>
                 <CardTitle>Solve Management</CardTitle>
                 <CardDescription>Audit and manage competition results</CardDescription>
                 <div className="flex gap-4 pt-4">
                    <Select value={solveSearchComp} onValueChange={setSolveSearchComp}>
                       <SelectTrigger className="w-[300px]"><SelectValue placeholder="Select Competition" /></SelectTrigger>
                       <SelectContent>
                          {competitions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                       </SelectContent>
                    </Select>
                    <Input 
                      placeholder="Filter by User / ID..." 
                      className="max-w-xs" 
                      value={solveSearchUser} 
                      onChange={e => setSolveSearchUser(e.target.value)} 
                    />
                    <Button onClick={fetchSolves} disabled={!solveSearchComp}>
                       <Search className="w-4 h-4 mr-2" /> Search
                    </Button>
                 </div>
              </CardHeader>
              <CardContent>
                 {loadingData ? <div className="text-center py-8">Loading...</div> : 
                  solves.length === 0 ? <div className="text-center py-8 text-gray-500">No solves found</div> : (
                  <Table>
                    <TableHeader>
                       <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Event</TableHead>
                          <TableHead>Times</TableHead>
                          <TableHead>Penalty</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {solves.map(solve => (
                          <TableRow key={solve.id}>
                             <TableCell>
                                <div className="font-medium">{solve.userName}</div>
                                <div className="text-xs text-gray-500">{solve.wcaStyleId}</div>
                             </TableCell>
                             <TableCell>{getEventName(solve.eventId)}</TableCell>
                             <TableCell className="font-mono text-xs">
                                {(solve.times || []).map(t => (t/1000).toFixed(2)).join(', ')}
                             </TableCell>
                             <TableCell>
                                <Badge variant={solve.penalty === 'DNF' ? 'destructive' : solve.penalty === '+2' ? 'warning' : 'outline'}>
                                   {solve.penalty || 'NONE'}
                                </Badge>
                             </TableCell>
                             <TableCell>
                                {solve.editedByAdmin && <Badge variant="secondary" className="text-[10px]">Admin Edited</Badge>}
                             </TableCell>
                             <TableCell>
                                <div className="flex gap-2">
                                   <Dialog open={editingSolve?.id === solve.id} onOpenChange={open => !open && setEditingSolve(null)}>
                                      <DialogTrigger asChild>
                                         <Button size="sm" variant="ghost" onClick={() => setEditingSolve(solve)}><Gavel className="h-4 w-4" /></Button>
                                      </DialogTrigger>
                                      <DialogContent>
                                         <DialogHeader><DialogTitle>Adjudicate Solve</DialogTitle></DialogHeader>
                                         <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                               <Label>Penalty</Label>
                                               <Select value={editingSolve?.penalty || 'NONE'} onValueChange={v => setEditingSolve({...editingSolve, penalty: v})}>
                                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                                  <SelectContent>
                                                     <SelectItem value="NONE">No Penalty</SelectItem>
                                                     <SelectItem value="+2">+2 Seconds</SelectItem>
                                                     <SelectItem value="DNF">DNF</SelectItem>
                                                  </SelectContent>
                                               </Select>
                                            </div>
                                            <div className="space-y-2">
                                               <Label>Flag / Note</Label>
                                               <Textarea 
                                                  placeholder="Reason for change..." 
                                                  value={editingSolve?.flagReason || ''} 
                                                  onChange={e => setEditingSolve({...editingSolve, flagReason: e.target.value})} 
                                               />
                                            </div>
                                         </div>
                                         <DialogFooter>
                                            <Button onClick={handleUpdateSolve}>Apply Ruling</Button>
                                         </DialogFooter>
                                      </DialogContent>
                                   </Dialog>
                                   <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeleteSolve(solve.id)}><Trash2 className="h-4 w-4" /></Button>
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

        </Tabs>
      </div>
    </div>
  );
}

export default AdminPanel;