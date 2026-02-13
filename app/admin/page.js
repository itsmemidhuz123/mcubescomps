'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Shield, Users, Trophy, Edit, Eye, CreditCard, Download, EyeOff } from 'lucide-react';
import { WCA_EVENTS, getEventName } from '@/lib/wcaEvents';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';

function Header() {
  const { userProfile, signOut } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="text-xl font-bold text-gray-900">MCUBES</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-gray-600 hover:text-gray-900 font-medium">Home</Link>
            <Link href="/competitions" className="text-gray-600 hover:text-gray-900 font-medium">Competitions</Link>
            <Link href="/rankings" className="text-gray-600 hover:text-gray-900 font-medium">Rankings</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Badge className="bg-purple-100 text-purple-700">
              <Shield className="w-3 h-3 mr-1" /> Admin
            </Badge>
            <Button variant="outline" size="sm" onClick={() => router.push('/profile')}>
              {userProfile?.displayName || 'Profile'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>Logout</Button>
          </div>
        </div>
      </div>
    </header>
  );
}

function AdminPanel() {
  const { user, userProfile, isAdmin, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('create');
  const [competitions, setCompetitions] = useState([]);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [editingComp, setEditingComp] = useState(null);

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

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
      return;
    }
    
    if (!loading && user && !isAdmin) {
      alert('Access denied. Admin only.');
      router.push('/');
      return;
    }
  }, [user, isAdmin, loading, router]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchData();
    }
  }, [user, isAdmin]);

  async function fetchData() {
    try {
      const compsSnapshot = await getDocs(collection(db, 'competitions'));
      const compsData = compsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      compsData.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setCompetitions(compsData);

      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);

      const paymentsSnapshot = await getDocs(collection(db, 'payments'));
      const paymentsData = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      paymentsData.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setPayments(paymentsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoadingData(false);
    }
  }

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

  const resetForm = () => {
    setFormData({
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
    setEditingComp(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.selectedEvents.length === 0) {
      alert('Please select at least one event');
      return;
    }

    for (const eventId of formData.selectedEvents) {
      const scrambles = formData.scrambles[eventId];
      if (!scrambles || scrambles.some(s => !s?.trim())) {
        alert(`Please enter all ${formData.solveLimit} scrambles for ${getEventName(eventId)}`);
        return;
      }
    }

    if (!formData.registrationOpenDate || !formData.registrationCloseDate || 
        !formData.competitionStartDate || !formData.competitionEndDate) {
      alert('Please fill all date fields');
      return;
    }

    const compData = {
      name: formData.name,
      description: formData.description,
      registrationOpenDate: formData.registrationOpenDate,
      registrationCloseDate: formData.registrationCloseDate,
      competitionStartDate: formData.competitionStartDate,
      competitionEndDate: formData.competitionEndDate,
      startDate: formData.competitionStartDate,
      endDate: formData.competitionEndDate,
      type: formData.type,
      pricingModel: formData.pricingModel,
      flatPrice: parseFloat(formData.flatPrice) || 0,
      basePrice: parseFloat(formData.basePrice) || 0,
      perEventPrice: parseFloat(formData.perEventPrice) || 0,
      currency: formData.currency,
      solveLimit: parseInt(formData.solveLimit),
      events: formData.selectedEvents,
      scrambles: formData.scrambles,
      published: formData.published,
      updatedAt: new Date().toISOString(),
      participantCount: editingComp?.participantCount || 0
    };

    try {
      if (editingComp) {
        await updateDoc(doc(db, 'competitions', editingComp.id), compData);
        alert('Competition updated successfully!');
      } else {
        compData.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'competitions'), compData);
        alert('Competition created successfully!');
      }
      fetchData();
      resetForm();
    } catch (error) {
      console.error('Failed to save competition:', error);
      alert('Failed to save competition: ' + error.message);
    }
  };

  const handleEdit = (comp) => {
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
      registrationOpenDate: comp.registrationOpenDate || comp.startDate || '',
      registrationCloseDate: comp.registrationCloseDate || comp.startDate || '',
      competitionStartDate: comp.competitionStartDate || comp.startDate || '',
      competitionEndDate: comp.competitionEndDate || comp.endDate || '',
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
    setActiveTab('create');
  };

  const handleDelete = async (compId) => {
    if (!confirm('Are you sure you want to delete this competition?')) return;
    try {
      await deleteDoc(doc(db, 'competitions', compId));
      fetchData();
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Failed to delete: ' + error.message);
    }
  };

  const handleTogglePublish = async (comp) => {
    try {
      await updateDoc(doc(db, 'competitions', comp.id), {
        published: !comp.published
      });
      fetchData();
    } catch (error) {
      console.error('Failed to toggle publish:', error);
      alert('Failed to update: ' + error.message);
    }
  };

  const downloadResultsCSV = async (comp) => {
    try {
      const resultsQuery = query(
        collection(db, 'results'),
        where('competitionId', '==', comp.id)
      );
      const resultsSnapshot = await getDocs(resultsQuery);
      
      if (resultsSnapshot.empty) {
        alert('No results found for this competition');
        return;
      }

      const results = resultsSnapshot.docs.map(doc => doc.data());
      
      // Group by event
      const eventGroups = {};
      results.forEach(r => {
        if (!eventGroups[r.eventId]) eventGroups[r.eventId] = [];
        eventGroups[r.eventId].push(r);
      });

      let csvContent = 'Competition: ' + comp.name + '\n\n';
      
      Object.keys(eventGroups).forEach(eventId => {
        const eventResults = eventGroups[eventId];
        eventResults.sort((a, b) => {
          const avgA = a.average === Infinity ? 999999 : (a.average || 999999);
          const avgB = b.average === Infinity ? 999999 : (b.average || 999999);
          return avgA - avgB;
        });

        csvContent += `Event: ${getEventName(eventId)}\n`;
        csvContent += 'Rank,Name,MCUBES ID,Country,Average,Best Single,Solve 1,Solve 2,Solve 3,Solve 4,Solve 5\n';
        
        eventResults.forEach((r, idx) => {
          const times = (r.times || []).map(t => t === Infinity ? 'DNF' : (t / 1000).toFixed(2)).join(',');
          const avg = r.average === Infinity ? 'DNF' : ((r.average || 0) / 1000).toFixed(2);
          const best = r.bestSingle === Infinity ? 'DNF' : ((r.bestSingle || 0) / 1000).toFixed(2);
          csvContent += `${idx + 1},"${r.userName}",${r.wcaStyleId},${r.country},${avg},${best},${times}\n`;
        });
        csvContent += '\n';
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${comp.name.replace(/[^a-z0-9]/gi, '_')}_results.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download CSV:', error);
      alert('Failed to download: ' + error.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getRegistrationStatus = (comp) => {
    const now = new Date();
    const regOpen = comp.registrationOpenDate ? new Date(comp.registrationOpenDate) : null;
    const regClose = comp.registrationCloseDate ? new Date(comp.registrationCloseDate) : null;
    if (!regOpen || !regClose) return { status: 'unknown', label: 'Unknown' };
    if (now < regOpen) return { status: 'not_opened', label: 'Not Opened' };
    if (now > regClose) return { status: 'closed', label: 'Closed' };
    return { status: 'open', label: 'Open' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-xl">Loading...</div>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
          <p className="text-gray-500">Manage competitions, users, and platform settings</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{competitions.length}</p>
                  <p className="text-gray-500 text-sm">Competitions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{users.length}</p>
                  <p className="text-gray-500 text-sm">Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{payments.length}</p>
                  <p className="text-gray-500 text-sm">Payments</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{users.filter(u => u.role === 'ADMIN').length}</p>
                  <p className="text-gray-500 text-sm">Admins</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button variant={activeTab === 'create' ? 'default' : 'outline'} onClick={() => { setActiveTab('create'); resetForm(); }}>
            {editingComp ? 'Edit Competition' : 'Create Competition'}
          </Button>
          <Button variant={activeTab === 'manage' ? 'default' : 'outline'} onClick={() => setActiveTab('manage')}>
            Manage Competitions
          </Button>
          <Button variant={activeTab === 'users' ? 'default' : 'outline'} onClick={() => setActiveTab('users')}>
            Users
          </Button>
          <Button variant={activeTab === 'payments' ? 'default' : 'outline'} onClick={() => setActiveTab('payments')}>
            Payments
          </Button>
        </div>

        {/* CREATE/EDIT TAB */}
        {activeTab === 'create' && (
          <Card>
            <CardHeader>
              <CardTitle>{editingComp ? `Edit: ${editingComp.name}` : 'Create New Competition'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>Competition Name *</Label>
                    <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g., Cubing Clash 3.0" />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label>Description</Label>
                    <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} placeholder="Competition description..." />
                  </div>

                  {/* Publish Toggle */}
                  <div className="col-span-2 flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <Switch checked={formData.published} onCheckedChange={(checked) => setFormData({ ...formData, published: checked })} />
                    <div>
                      <Label className="text-base">Published</Label>
                      <p className="text-sm text-gray-500">{formData.published ? 'Visible to all users' : 'Hidden from public'}</p>
                    </div>
                  </div>

                  {/* Registration Dates */}
                  <div className="col-span-2 bg-blue-50 p-4 rounded-lg space-y-4">
                    <h3 className="font-semibold text-blue-900">Registration Window</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Registration Opens *</Label>
                        <Input type="datetime-local" value={formData.registrationOpenDate} onChange={(e) => setFormData({ ...formData, registrationOpenDate: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Registration Closes *</Label>
                        <Input type="datetime-local" value={formData.registrationCloseDate} onChange={(e) => setFormData({ ...formData, registrationCloseDate: e.target.value })} required />
                      </div>
                    </div>
                  </div>

                  {/* Competition Dates */}
                  <div className="col-span-2 bg-green-50 p-4 rounded-lg space-y-4">
                    <h3 className="font-semibold text-green-900">Competition Window</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Competition Starts *</Label>
                        <Input type="datetime-local" value={formData.competitionStartDate} onChange={(e) => setFormData({ ...formData, competitionStartDate: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Competition Ends *</Label>
                        <Input type="datetime-local" value={formData.competitionEndDate} onChange={(e) => setFormData({ ...formData, competitionEndDate: e.target.value })} required />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Competition Type</Label>
                    <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FREE">FREE</SelectItem>
                        <SelectItem value="PAID">PAID</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Format: Ao{formData.solveLimit}</Label>
                    <Input type="number" value={formData.solveLimit} onChange={(e) => setFormData({ ...formData, solveLimit: parseInt(e.target.value) || 5 })} min="1" max="100" />
                  </div>
                </div>

                {/* Pricing Section */}
                {formData.type === 'PAID' && (
                  <div className="bg-yellow-50 p-4 rounded-lg space-y-4">
                    <h3 className="font-semibold text-yellow-900">Pricing Configuration</h3>
                    <div className="space-y-2">
                      <Label>Pricing Model</Label>
                      <Select value={formData.pricingModel} onValueChange={(value) => setFormData({ ...formData, pricingModel: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat">Flat Fee (Same price regardless of events)</SelectItem>
                          <SelectItem value="base_plus_extra">Base + Per Event (Base fee + extra per additional event)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {formData.pricingModel === 'flat' && (
                        <div className="space-y-2">
                          <Label>Flat Price ({formData.currency})</Label>
                          <Input type="number" value={formData.flatPrice} onChange={(e) => setFormData({ ...formData, flatPrice: e.target.value })} min="0" placeholder="e.g., 99" />
                        </div>
                      )}
                      {formData.pricingModel === 'base_plus_extra' && (
                        <>
                          <div className="space-y-2">
                            <Label>Base Price ({formData.currency})</Label>
                            <Input type="number" value={formData.basePrice} onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })} min="0" placeholder="e.g., 50" />
                          </div>
                          <div className="space-y-2">
                            <Label>Per Additional Event ({formData.currency})</Label>
                            <Input type="number" value={formData.perEventPrice} onChange={(e) => setFormData({ ...formData, perEventPrice: e.target.value })} min="0" placeholder="e.g., 20" />
                          </div>
                        </>
                      )}
                      <div className="space-y-2">
                        <Label>Currency</Label>
                        <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INR">INR (₹)</SelectItem>
                            <SelectItem value="USD">USD ($)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Events Selection */}
                <div className="space-y-4">
                  <Label className="text-lg">Select Events *</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {WCA_EVENTS.map(event => (
                      <div key={event.id} className="flex items-center space-x-2">
                        <Checkbox id={event.id} checked={formData.selectedEvents.includes(event.id)} onCheckedChange={() => handleEventToggle(event.id)} />
                        <label htmlFor={event.id} className="text-sm cursor-pointer">{event.icon} {event.name}</label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scrambles */}
                {formData.selectedEvents.length > 0 && (
                  <div className="space-y-6">
                    <Label className="text-lg">Enter Scrambles ({formData.solveLimit} per event) *</Label>
                    {formData.selectedEvents.map(eventId => {
                      const event = WCA_EVENTS.find(e => e.id === eventId);
                      return (
                        <div key={eventId} className="space-y-3 p-4 bg-gray-50 rounded-lg">
                          <h3 className="font-semibold">{event?.icon} {event?.name}</h3>
                          {Array.from({ length: formData.solveLimit }, (_, i) => (
                            <div key={i} className="space-y-1">
                              <Label className="text-gray-500 text-sm">Scramble {i + 1}</Label>
                              <Textarea value={formData.scrambles[eventId]?.[i] || ''} onChange={(e) => handleScrambleChange(eventId, i, e.target.value)} placeholder="Enter scramble..." className="font-mono text-sm" rows={2} />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-4">
                  <Button type="submit" className="flex-1 py-6 text-lg">
                    <Plus className="h-5 w-5 mr-2" />
                    {editingComp ? 'Update Competition' : 'Create Competition'}
                  </Button>
                  {editingComp && (
                    <Button type="button" variant="outline" onClick={resetForm} className="py-6">Cancel</Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* MANAGE TAB */}
        {activeTab === 'manage' && (
          <div className="space-y-4">
            {loadingData ? (
              <p className="text-center py-8 text-gray-500">Loading...</p>
            ) : competitions.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-gray-500">No competitions created yet</CardContent></Card>
            ) : (
              competitions.map(comp => {
                const regStatus = getRegistrationStatus(comp);
                return (
                  <Card key={comp.id} className={!comp.published ? 'opacity-60' : ''}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-xl font-bold">{comp.name}</h3>
                            {!comp.published && <Badge variant="outline" className="text-gray-500"><EyeOff className="w-3 h-3 mr-1" />Unpublished</Badge>}
                          </div>
                          <div className="text-sm text-gray-500 mb-2">
                            <p>Reg: {formatDate(comp.registrationOpenDate)} - {formatDate(comp.registrationCloseDate)}</p>
                            <p>Comp: {formatDate(comp.competitionStartDate || comp.startDate)} - {formatDate(comp.competitionEndDate || comp.endDate)}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge className={comp.type === 'FREE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>{comp.type}</Badge>
                            <Badge className={regStatus.status === 'open' ? 'bg-blue-100 text-blue-700' : regStatus.status === 'closed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}>Reg: {regStatus.label}</Badge>
                            <Badge variant="outline">{comp.events?.length || 0} events</Badge>
                            <Badge variant="outline">{comp.participantCount || 0} participants</Badge>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(comp)} title="Edit"><Edit className="h-4 w-4" /></Button>
                            <Button variant="outline" size="sm" onClick={() => router.push(`/competition/${comp.id}`)} title="View"><Eye className="h-4 w-4" /></Button>
                            <Button variant="outline" size="sm" onClick={() => downloadResultsCSV(comp)} title="Download CSV"><Download className="h-4 w-4" /></Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDelete(comp.id)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                          <Button variant={comp.published ? 'outline' : 'default'} size="sm" onClick={() => handleTogglePublish(comp)} className="w-full">
                            {comp.published ? 'Unpublish' : 'Publish'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <Card>
            <CardHeader><CardTitle>All Users ({users.length})</CardTitle></CardHeader>
            <CardContent>
              {loadingData ? (
                <p className="text-center py-8 text-gray-500">Loading...</p>
              ) : users.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No users yet</p>
              ) : (
                <div className="space-y-2">
                  {users.map(u => (
                    <div key={u.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{u.displayName || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">{u.email} • {u.wcaStyleId}</p>
                        <p className="text-xs text-gray-400">Joined: {formatDate(u.createdAt)}</p>
                      </div>
                      <Badge className={u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}>{u.role || 'USER'}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* PAYMENTS TAB */}
        {activeTab === 'payments' && (
          <Card>
            <CardHeader><CardTitle>All Payments ({payments.length})</CardTitle></CardHeader>
            <CardContent>
              {loadingData ? (
                <p className="text-center py-8 text-gray-500">Loading...</p>
              ) : payments.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No payments yet</p>
              ) : (
                <div className="space-y-2">
                  {payments.map(payment => (
                    <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{payment.userName || 'Unknown User'}</p>
                        <p className="text-sm text-gray-500">{payment.competitionName || 'Competition'}</p>
                        <p className="text-xs text-gray-400">Payment ID: {payment.paymentId?.slice(-12) || 'N/A'} • {formatDate(payment.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{payment.currency === 'INR' ? '₹' : '$'}{payment.amount || 0}</p>
                        <Badge className={payment.status === 'SUCCESS' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>{payment.status || 'PENDING'}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
