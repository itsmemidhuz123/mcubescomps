'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, limit } from 'firebase/firestore';
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
import { RefreshCw, FileDown, Trophy, Users, DollarSign, Activity, Check } from 'lucide-react';
import { WCA_EVENTS, getEventName } from '@/lib/wcaEvents';

export default function AdminPanel() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  
  // Data States
  const [competitions, setCompetitions] = useState([]);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
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
    date: '',
    type: 'FREE', // FREE or PAID
    currency: 'INR', // INR or USD
    pricingModel: 'flat', // flat or base_plus_extra
    flatPrice: 0,
    basePrice: 0,
    perEventPrice: 0,
    solveLimit: 5,
    selectedEvents: [],
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
      // Competitions
      const compsSnap = await getDocs(collection(db, 'competitions'));
      const compsData = compsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      compsData.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
      setCompetitions(compsData);

      // Users
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersData = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);

      // Payments
      const paymentsSnap = await getDocs(collection(db, 'payments'));
      const paymentsData = paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      paymentsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setPayments(paymentsData);

      // Audit Logs
      const auditQuery = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(50));
      const auditSnap = await getDocs(auditQuery);
      setAuditLogs(auditSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Stats Calculation
      const totalRevenue = paymentsData
        .filter(p => p.status === 'SUCCESS')
        .reduce((sum, p) => {
          // Convert USD to INR for total display (approx)
          const amount = parseFloat(p.amount) || 0;
          return sum + (p.currency === 'USD' ? amount * 90 : amount);
        }, 0);

      setStats({
        totalUsers: usersData.length,
        totalRevenue,
        activeCompetitions: compsData.filter(c => c.status === 'UPCOMING' || c.status === 'LIVE').length
      });

    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoadingData(false);
    }
  }

  const handleCompSubmit = async (e) => {
    e.preventDefault();
    if (formData.selectedEvents.length === 0) return alert('Select at least one event');

    // Scramble Validation
    for (const eventId of formData.selectedEvents) {
      const eventScrambles = formData.scrambles[eventId];
      if (!eventScrambles || eventScrambles.length < 5 || eventScrambles.some(s => !s?.trim())) {
        return alert(`Please enter all 5 scrambles for ${getEventName(eventId)}`);
      }
    }

    const compData = {
      name: formData.name,
      date: formData.date,
      type: formData.type,
      currency: formData.currency,
      pricingModel: formData.pricingModel,
      flatPrice: Number(formData.flatPrice),
      basePrice: Number(formData.basePrice),
      perEventPrice: Number(formData.perEventPrice),
      solveLimit: Number(formData.solveLimit),
      events: formData.selectedEvents,
      scrambles: formData.scrambles,
      isPublished: formData.isPublished,
      status: new Date(formData.date) > new Date() ? 'UPCOMING' : 'LIVE',
      updatedAt: new Date().toISOString()
    };

    if (!editingComp) {
      compData.createdAt = new Date().toISOString();
      compData.participantCount = 0;
    }

    try {
      if (editingComp) {
        await updateDoc(doc(db, 'competitions', editingComp.id), compData);
        alert('Competition updated');
      } else {
        await addDoc(collection(db, 'competitions'), compData);
        alert('Competition created');
      }
      setEditingComp(null);
      resetForm();
      fetchData();
    } catch (error) {
      alert('Error saving competition: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', date: '', type: 'FREE', currency: 'INR', pricingModel: 'flat',
      flatPrice: 0, basePrice: 0, perEventPrice: 0,
      solveLimit: 5, selectedEvents: [], scrambles: {}, isPublished: false
    });
  };

  const loadCompForEdit = (comp) => {
    setEditingComp(comp);
    setFormData({
      name: comp.name || '',
      date: comp.date || comp.startDate || '',
      type: comp.type || 'FREE',
      currency: comp.currency || 'INR',
      pricingModel: comp.pricingModel || 'flat',
      flatPrice: comp.flatPrice || comp.registrationFee || 0,
      basePrice: comp.basePrice || 0,
      perEventPrice: comp.perEventPrice || 0,
      solveLimit: comp.solveLimit || 5,
      selectedEvents: comp.events || [],
      scrambles: comp.scrambles || {},
      isPublished: comp.isPublished || false
    });
  };

  const handleEventToggle = (eventId) => {
    setFormData(prev => {
      const newEvents = prev.selectedEvents.includes(eventId)
        ? prev.selectedEvents.filter(id => id !== eventId)
        : [...prev.selectedEvents, eventId];
      return { ...prev, selectedEvents: newEvents };
    });
  };

  const handleScrambleChange = (eventId, index, value) => {
    setFormData(prev => {
      const currentScrambles = prev.scrambles[eventId] || Array(5).fill('');
      const newScrambles = [...currentScrambles];
      newScrambles[index] = value;
      return {
        ...prev,
        scrambles: { ...prev.scrambles, [eventId]: newScrambles }
      };
    });
  };

  const handleExportPayments = () => {
    if (!payments.length) return alert('No payments to export');
    
    const headers = ['ID', 'User Email', 'Amount', 'Currency', 'Status', 'Date', 'Competition ID'];
    const rows = payments.map(p => [
      p.id, p.userEmail || 'N/A', p.amount, p.currency, p.status,
      new Date(p.createdAt).toLocaleString(), p.competitionId || 'N/A'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
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
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="competitions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{editingComp ? 'Edit Competition' : 'Create New Competition'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCompSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Competition Name</Label>
                    <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
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
                        <Label>Pricing Model</Label>
                        <RadioGroup 
                          value={formData.pricingModel} 
                          onValueChange={val => setFormData({...formData, pricingModel: val})}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="flat" id="model-flat" />
                            <Label htmlFor="model-flat">Flat Fee (One price for any number of events)</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="base_plus_extra" id="model-base" />
                            <Label htmlFor="model-base">Base Fee + Per Event Fee</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {formData.pricingModel === 'flat' ? (
                          <div className="space-y-2">
                            <Label>Flat Registration Fee</Label>
                            <Input type="number" value={formData.flatPrice} onChange={e => setFormData({...formData, flatPrice: e.target.value})} required />
                          </div>
                        ) : (
                          <>
                            <div className="space-y-2">
                              <Label>Base Fee (Includes 1st event)</Label>
                              <Input type="number" value={formData.basePrice} onChange={e => setFormData({...formData, basePrice: e.target.value})} required />
                            </div>
                            <div className="space-y-2">
                              <Label>Fee Per Extra Event</Label>
                              <Input type="number" value={formData.perEventPrice} onChange={e => setFormData({...formData, perEventPrice: e.target.value})} required />
                            </div>
                          </>
                        )}
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
                  <TableHead>Date</TableHead>
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
                    <TableCell>{new Date(comp.date || comp.startDate).toLocaleDateString()}</TableCell>
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
                    <TableHead>WCA ID</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.id}>
                      <TableCell>{u.displayName || 'N/A'}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.wcaId || '-'}</TableCell>
                      <TableCell><Badge variant="outline">{u.status || 'ACTIVE'}</Badge></TableCell>
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
                    <TableHead>User</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>{p.userEmail}</TableCell>
                      <TableCell>{p.currency} {p.amount}</TableCell>
                      <TableCell><Badge>{p.status}</Badge></TableCell>
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