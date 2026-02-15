'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Save, Trophy, CreditCard, User, Award, TrendingUp, LogOut, Shield, MapPin, Calendar, Hash, Crown } from 'lucide-react';
import { getEventName, getEventIcon } from '@/lib/wcaEvents';
import Link from 'next/link';

const COUNTRIES = [
  'India', 'United States', 'China', 'United Kingdom', 'Australia',
  'Canada', 'Germany', 'France', 'Japan', 'South Korea', 'Brazil',
  'Russia', 'Italy', 'Spain', 'Netherlands', 'Other'
];

function Header() {
  const { user, userProfile, signOut, isAdmin } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-black/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="relative w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600 group-hover:scale-105 transition-transform duration-300">
             <span className="font-bold text-white text-sm">M</span>
          </div>
          <span className="font-bold text-lg tracking-tight text-white group-hover:text-blue-400 transition-colors">MCUBES</span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Home</Link>
          <Link href="/competitions" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Competitions</Link>
          <Link href="/rankings" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Rankings</Link>
        </nav>

        <div className="flex items-center gap-3">
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => router.push('/admin')} className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-8 text-xs uppercase tracking-wider font-semibold">
                <Shield className="w-3 h-3 mr-1.5" />
                Admin
              </Button>
            )}
            <div className="h-4 w-[1px] bg-white/10 mx-1 hidden sm:block" />
            <Button variant="ghost" size="sm" onClick={() => signOut()} className="text-zinc-400 hover:text-white hover:bg-white/5 h-8 text-xs uppercase tracking-wider font-semibold">
              <LogOut className="w-3 h-3 mr-1.5" />
              Logout
            </Button>
        </div>
      </div>
    </header>
  );
}

function StatCard({ icon: Icon, label, value, colorClass }) {
  return (
    <Card className="bg-zinc-900/50 border-white/5 hover:border-white/10 transition-colors">
      <CardContent className="p-6 flex items-center gap-4">
        <div className={`p-3 rounded-xl bg-opacity-10 ${colorClass.bg}`}>
          <Icon className={`w-6 h-6 ${colorClass.text}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfilePage() {
  const { user, userProfile, loading, updateProfile } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    country: '',
    wcaId: ''
  });
  const [competitions, setCompetitions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [results, setResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (userProfile) {
      setFormData({
        displayName: userProfile.displayName || '',
        username: userProfile.username || '',
        country: userProfile.country || '',
        wcaId: userProfile.wcaId || ''
      });
      fetchUserData();
    }
  }, [userProfile]);

  async function fetchUserData() {
    if (!user) return;
    
    try {
      const registrationsQuery = query(
        collection(db, 'registrations'),
        where('userId', '==', user.uid)
      );
      const regSnapshot = await getDocs(registrationsQuery);
      const compIds = regSnapshot.docs.map(doc => doc.data().competitionId);
      
      const compData = [];
      for (const compId of compIds) {
        try {
          const compDoc = await getDoc(doc(db, 'competitions', compId));
          if (compDoc.exists()) {
            compData.push({ id: compDoc.id, ...compDoc.data() });
          }
        } catch (e) {
          console.error('Error fetching competition:', e);
        }
      }
      setCompetitions(compData);

      const paymentsQuery = query(
        collection(db, 'payments'),
        where('userId', '==', user.uid)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      setPayments(paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const resultsQuery = query(
        collection(db, 'results'),
        where('userId', '==', user.uid)
      );
      const resultsSnapshot = await getDocs(resultsQuery);
      setResults(resultsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setDataLoading(false);
    }
  }

  async function handleSave() {
    if (!user) return;
    
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      await updateProfile({
        displayName: formData.displayName,
        username: formData.username,
        country: formData.country,
        wcaId: formData.wcaId
      });
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error) {
      console.error('Failed to update profile:', error);
      setMessage({ type: 'error', text: 'Failed to update profile: ' + error.message });
    } finally {
      setSaving(false);
    }
  }

  const formatTime = (ms) => {
    if (!ms || ms === Infinity || ms === 'DNF') return 'DNF';
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500 border-r-2 border-r-transparent"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-black text-zinc-100 selection:bg-blue-500/30">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        
        {/* Modern Profile Header */}
        <div className="relative group rounded-3xl bg-zinc-900/50 border border-white/5 p-6 md:p-8 overflow-hidden">
           <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-purple-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
           <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
           
           <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center">
              <Avatar className="w-24 h-24 border-4 border-black shadow-2xl ring-2 ring-white/10">
                <AvatarImage src={userProfile?.photoURL} />
                <AvatarFallback className="bg-zinc-800 text-2xl font-bold text-zinc-400">
                  {userProfile?.displayName?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <h1 className="text-3xl font-bold text-white tracking-tight">{userProfile?.displayName || 'User'}</h1>
                  <Badge className="w-fit bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                    {userProfile?.wcaStyleId || 'MEMBER'}
                  </Badge>
                </div>
                
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <User className="w-4 h-4 text-zinc-500" />
                    @{userProfile?.username || 'username'}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-zinc-500" />
                    {userProfile?.country || 'Unknown Location'}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-zinc-500" />
                    Joined {formatDate(userProfile?.createdAt)}
                  </div>
                </div>
              </div>

              {userProfile?.wcaId && (
                <div className="hidden md:block text-right">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">WCA ID</p>
                  <a href={`https://www.worldcubeassociation.org/persons/${userProfile.wcaId}`} target="_blank" rel="noopener noreferrer" className="text-2xl font-mono font-bold text-white hover:text-blue-400 transition-colors">
                    {userProfile.wcaId}
                  </a>
                </div>
              )}
           </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard 
            icon={Trophy} 
            value={competitions.length} 
            label="Competitions" 
            colorClass={{bg: 'bg-yellow-500', text: 'text-yellow-500'}} 
          />
          <StatCard 
            icon={Crown} 
            value={results.length} 
            label="Total Results" 
            colorClass={{bg: 'bg-purple-500', text: 'text-purple-500'}} 
          />
          <StatCard 
            icon={CreditCard} 
            value={payments.length} 
            label="Payments" 
            colorClass={{bg: 'bg-green-500', text: 'text-green-500'}} 
          />
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="bg-zinc-900/50 border border-white/5 p-1 h-auto">
              {['overview', 'edit', 'results', 'payments'].map((tab) => (
                <TabsTrigger 
                  key={tab}
                  value={tab} 
                  className="capitalize px-6 py-2 rounded-lg data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 hover:text-zinc-200 transition-all"
                >
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6 focus-visible:outline-none">
            <Card className="bg-zinc-900/50 border-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                 {dataLoading ? (
                  <div className="py-8 text-center text-zinc-500">Loading activity...</div>
                ) : competitions.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                      <Trophy className="w-6 h-6 text-zinc-500" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-1">No competitions yet</h3>
                    <p className="text-zinc-500 text-sm mb-4">Join a competition to start your journey!</p>
                    <Link href="/competitions">
                      <Button variant="outline" className="border-white/10 hover:bg-white/5 hover:text-white">
                        Browse Competitions
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {competitions.slice(0, 5).map(comp => (
                      <div key={comp.id} className="group flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/5 hover:border-white/10 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-lg">
                            🏆
                          </div>
                          <div>
                            <p className="font-medium text-white group-hover:text-blue-400 transition-colors">{comp.name}</p>
                            <p className="text-sm text-zinc-500">{formatDate(comp.startDate)} • {comp.city || 'Online'}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/competition/${comp.id}`)} className="text-zinc-400 hover:text-white">
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="edit" className="focus-visible:outline-none">
            <Card className="bg-zinc-900/50 border-white/5 max-w-2xl">
              <CardHeader>
                <CardTitle>Edit Profile</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                 {message.text && (
                  <div className={`p-4 rounded-lg border text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                    {message.text}
                  </div>
                )}
                
                <div className="grid gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      value={formData.displayName}
                      onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                      className="bg-black/20 border-white/10 focus:border-blue-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="grid gap-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                        className="bg-black/20 border-white/10 focus:border-blue-500/50"
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="wcaId">WCA ID</Label>
                      <Input
                        id="wcaId"
                        value={formData.wcaId}
                        onChange={(e) => setFormData({...formData, wcaId: e.target.value})}
                        placeholder="2024ABCD01"
                        className="bg-black/20 border-white/10 focus:border-blue-500/50"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="country">Country</Label>
                    <Select value={formData.country} onValueChange={(value) => setFormData({...formData, country: value})}>
                      <SelectTrigger className="bg-black/20 border-white/10 focus:border-blue-500/50">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10">
                        {COUNTRIES.map(country => (
                          <SelectItem key={country} value={country} className="focus:bg-zinc-800 text-zinc-300">
                            {country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Email Address</span>
                      <span className="text-zinc-300 font-mono">{userProfile?.email}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">System ID</span>
                      <span className="text-zinc-300 font-mono">{userProfile?.wcaStyleId}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                  >
                    {saving ? (
                      <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Saving...</span>
                    ) : (
                      <span className="flex items-center gap-2"><Save className="w-4 h-4" /> Save Changes</span>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="focus-visible:outline-none">
            <Card className="bg-zinc-900/50 border-white/5">
              <CardHeader>
                <CardTitle>My Results</CardTitle>
              </CardHeader>
              <CardContent>
                {!results.length ? (
                  <div className="text-center py-12 text-zinc-500">
                    No results found. Compete to earn your first result!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {results.map(result => (
                      <div key={result.id} className="p-5 rounded-xl bg-black/20 border border-white/5 hover:border-blue-500/30 transition-all group relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        <div className="relative z-10">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{getEventIcon(result.eventId)}</span>
                              <div>
                                <h4 className="font-semibold text-zinc-200 text-sm">{getEventName(result.eventId)}</h4>
                                <p className="text-xs text-zinc-500 font-mono">ID: {result.eventId}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="border-blue-500/20 text-blue-400 bg-blue-500/5">
                              Ao5
                            </Badge>
                          </div>
                          
                          <div className="space-y-1 mb-4">
                            <div className="flex justify-between items-end">
                              <span className="text-sm text-zinc-500">Average</span>
                              <span className="text-xl font-bold text-white font-mono">{formatTime(result.average)}</span>
                            </div>
                            <div className="flex justify-between items-end">
                              <span className="text-xs text-zinc-600">Best Single</span>
                              <span className="text-sm text-zinc-400 font-mono">{formatTime(result.bestSingle)}</span>
                            </div>
                          </div>

                          {result.times && (
                            <div className="flex gap-1 pt-3 border-t border-white/5">
                              {result.times.map((time, i) => (
                                <div key={i} className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                                  <div 
                                    className="h-full bg-blue-500/50" 
                                    style={{ width: time === Math.min(...result.times.filter(t => typeof t === 'number')) ? '100%' : '60%', opacity: time === Math.max(...result.times.filter(t => typeof t === 'number')) ? 0.3 : 1 }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="focus-visible:outline-none">
            <Card className="bg-zinc-900/50 border-white/5">
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                {!payments.length ? (
                  <div className="text-center py-12 text-zinc-500">
                    No payment history available.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {payments.map(payment => (
                      <div key={payment.id} className="flex items-center justify-between p-4 rounded-lg bg-black/20 border border-white/5">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${payment.status === 'SUCCESS' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                             {payment.status === 'SUCCESS' ? <Shield className="w-5 h-5" /> : <Award className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-medium text-white">{payment.competitionName || 'Competition Registration'}</p>
                            <p className="text-xs text-zinc-500 font-mono">{payment.paymentId || payment.id}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-white">{payment.currency === 'INR' ? '₹' : '$'}{payment.amount}</p>
                          <p className="text-xs text-zinc-500">{formatDate(payment.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
}

export default ProfilePage;