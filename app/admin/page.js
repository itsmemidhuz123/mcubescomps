'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Shield, Users, Trophy } from 'lucide-react';
import { WCA_EVENTS } from '@/lib/wcaEvents';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';

// Header Component
function Header() {
  const { user, userProfile, signOut, isAdmin } = useAuth();
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
  const [loadingData, setLoadingData] = useState(true);

  // Competition form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    type: 'FREE',
    pricingModel: 'flat',
    flatPrice: 0,
    basePrice: 0,
    extraPrice: 0,
    currency: 'INR',
    solveLimit: 5,
    selectedEvents: [],
    scrambles: {}
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
      // Fetch competitions
      const compsSnapshot = await getDocs(collection(db, 'competitions'));
      const compsData = compsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      compsData.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
      });
      setCompetitions(compsData);

      // Fetch users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
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
        scrambles: { ...formData.scrambles, [eventId]: ['', '', '', '', ''] }
      });
    }
  };

  const handleScrambleChange = (eventId, index, value) => {
    const newScrambles = { ...formData.scrambles };
    if (!newScrambles[eventId]) newScrambles[eventId] = ['', '', '', '', ''];
    newScrambles[eventId][index] = value;
    setFormData({ ...formData, scrambles: newScrambles });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.selectedEvents.length === 0) {
      alert('Please select at least one event');
      return;
    }

    // Check all scrambles are filled
    for (const eventId of formData.selectedEvents) {
      const scrambles = formData.scrambles[eventId];
      if (!scrambles || scrambles.some(s => !s.trim())) {
        alert(`Please enter all 5 scrambles for ${eventId}`);
        return;
      }
    }

    try {
      await addDoc(collection(db, 'competitions'), {
        name: formData.name,
        description: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate,
        type: formData.type,
        pricingModel: formData.pricingModel,
        flatPrice: parseFloat(formData.flatPrice) || 0,
        basePrice: parseFloat(formData.basePrice) || 0,
        extraPrice: parseFloat(formData.extraPrice) || 0,
        currency: formData.currency,
        solveLimit: parseInt(formData.solveLimit),
        events: formData.selectedEvents,
        scrambles: formData.scrambles,
        createdAt: new Date().toISOString(),
        participantCount: 0
      });

      alert('Competition created successfully!');
      fetchData();
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        type: 'FREE',
        pricingModel: 'flat',
        flatPrice: 0,
        basePrice: 0,
        extraPrice: 0,
        currency: 'INR',
        solveLimit: 5,
        selectedEvents: [],
        scrambles: {}
      });
    } catch (error) {
      console.error('Failed to create competition:', error);
      alert('Failed to create competition: ' + error.message);
    }
  };

  const handleDelete = async (compId) => {
    if (!confirm('Are you sure you want to delete this competition?')) return;

    try {
      await deleteDoc(doc(db, 'competitions', compId));
      fetchData();
    } catch (error) {
      console.error('Failed to delete competition:', error);
      alert('Failed to delete: ' + error.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  // Show loading while auth is being checked
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-500 text-xl">Loading...</div>
        </div>
      </div>
    );
  }

  // Don't render if not admin
  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
          <p className="text-gray-500">Manage competitions, users, and platform settings</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
                  <Shield className="w-6 h-6 text-green-600" />
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
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'create' ? 'default' : 'outline'}
            onClick={() => setActiveTab('create')}
          >
            Create Competition
          </Button>
          <Button
            variant={activeTab === 'manage' ? 'default' : 'outline'}
            onClick={() => setActiveTab('manage')}
          >
            Manage Competitions
          </Button>
          <Button
            variant={activeTab === 'users' ? 'default' : 'outline'}
            onClick={() => setActiveTab('users')}
          >
            Users
          </Button>
        </div>

        {activeTab === 'create' && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Competition</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>Competition Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="e.g., Cubing Clash 3.0"
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      placeholder="Competition description..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Start Date & Time *</Label>
                    <Input
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>End Date & Time *</Label>
                    <Input
                      type="datetime-local"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Competition Type</Label>
                    <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FREE">FREE</SelectItem>
                        <SelectItem value="PAID">PAID</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Solve Limit</Label>
                    <Input
                      type="number"
                      value={formData.solveLimit}
                      onChange={(e) => setFormData({ ...formData, solveLimit: e.target.value })}
                      min="1"
                      max="100"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-lg">Select Events *</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {WCA_EVENTS.map(event => (
                      <div key={event.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={event.id}
                          checked={formData.selectedEvents.includes(event.id)}
                          onCheckedChange={() => handleEventToggle(event.id)}
                        />
                        <label htmlFor={event.id} className="text-sm cursor-pointer">
                          {event.icon} {event.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {formData.selectedEvents.length > 0 && (
                  <div className="space-y-6">
                    <Label className="text-lg">Enter Scrambles (5 per event) *</Label>
                    {formData.selectedEvents.map(eventId => {
                      const event = WCA_EVENTS.find(e => e.id === eventId);
                      return (
                        <div key={eventId} className="space-y-3 p-4 bg-gray-50 rounded-lg">
                          <h3 className="font-semibold">{event?.icon} {event?.name}</h3>
                          {[0, 1, 2, 3, 4].map(i => (
                            <div key={i} className="space-y-1">
                              <Label className="text-gray-500 text-sm">Scramble {i + 1}</Label>
                              <Textarea
                                value={formData.scrambles[eventId]?.[i] || ''}
                                onChange={(e) => handleScrambleChange(eventId, i, e.target.value)}
                                placeholder="Enter scramble..."
                                className="font-mono text-sm"
                                rows={2}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button type="submit" className="w-full py-6 text-lg">
                  <Plus className="h-5 w-5 mr-2" />
                  Create Competition
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {activeTab === 'manage' && (
          <div className="space-y-4">
            {loadingData ? (
              <p className="text-center py-8 text-gray-500">Loading...</p>
            ) : competitions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  No competitions created yet
                </CardContent>
              </Card>
            ) : (
              competitions.map(comp => (
                <Card key={comp.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-2">{comp.name}</h3>
                        <div className="flex flex-wrap gap-2 text-sm text-gray-500">
                          <span>{formatDate(comp.startDate)} - {formatDate(comp.endDate)}</span>
                          <span>•</span>
                          <span>{comp.events?.length || 0} events</span>
                          <span>•</span>
                          <Badge className={comp.type === 'FREE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                            {comp.type}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(comp.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <Card>
            <CardHeader>
              <CardTitle>All Users ({users.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <p className="text-center py-8 text-gray-500">Loading...</p>
              ) : users.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No users yet</p>
              ) : (
                <div className="space-y-2">
                  {users.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{user.displayName || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">{user.email} • {user.wcaStyleId}</p>
                      </div>
                      <Badge className={user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}>
                        {user.role || 'USER'}
                      </Badge>
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
