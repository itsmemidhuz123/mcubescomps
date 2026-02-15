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
import { Save, Trophy, CreditCard, User, Award, TrendingUp, LogOut, Shield, MapPin, Calendar, Hash, Crown, LayoutDashboard, Settings, Activity } from 'lucide-react';
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
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-black/50 backdrop-blur-xl supports-[backdrop-filter]:bg-black/20">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-violet-600 text-white font-bold text-sm shadow-lg shadow-blue-900/20">M</div>
          <span className="font-bold text-lg tracking-tight text-white/90">MCUBES</span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Home</Link>
          <Link href="/competitions" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Competitions</Link>
          <Link href="/rankings" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Rankings</Link>
        </nav>

        <div className="flex items-center gap-3">
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => router.push('/admin')} className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-8 text-xs font-medium">
                <Shield className="w-3.5 h-3.5 mr-1.5" />
                Admin
              </Button>
            )}
            <div className="h-4 w-[1px] bg-white/10 mx-1 hidden sm:block" />
            <Button variant="ghost" size="sm" onClick={() => signOut()} className="text-zinc-400 hover:text-white hover:bg-white/5 h-8 text-xs font-medium">
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Logout
            </Button>
        </div>
      </div>
    </header>
  );
}

function StatCard({ icon: Icon, label, value, colorClass }) {
  return (
    <Card className="bg-zinc-900/20 border-white/5 hover:border-white/10 transition-colors backdrop-blur-sm">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`p-2.5 rounded-xl bg-opacity-10 ${colorClass.bg}`}>
          <Icon className={`w-5 h-5 ${colorClass.text}`} />
        </div>
        <div>
          <p className="text-xl font-bold text-white leading-tight">{value}</p>
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
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
      {/* Subtle Background Glow */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black pointer-events-none" />
      
      <div className="relative z-10">
        <Header />
        
        <main className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
          
          {/* Minimalist Profile Hero */}
          <div className="relative rounded-2xl bg-zinc-900/30 border border-white/5 p-6 backdrop-blur-xl overflow-hidden">
             {/* Gradient accent */}
             <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
             
             <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center">
                <Avatar className="w-20 h-20 border-2 border-white/10 shadow-xl ring-2 ring-black/50">
                  <AvatarImage src={userProfile?.photoURL} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-700 text-xl font-bold text-white">
                    {userProfile?.displayName?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-2">
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <h1 className="text-2xl font-bold text-white tracking-tight">{userProfile?.displayName || 'User'}</h1>
                    <Badge variant="outline" className="w-fit border-blue-500/20 text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 transition-colors px-2 py-0.5 text-xs">
                      {userProfile?.wcaStyleId || 'MEMBER'}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-zinc-500" />
                      @{userProfile?.username || 'username'}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                      {userProfile?.country || 'Unknown Location'}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                      Joined {formatDate(userProfile?.createdAt)}
                    </div>
                  </div>
                </div>

                {userProfile?.wcaId && (
                  <div className="hidden md:block text-right bg-white/5 px-4 py-2 rounded-lg border border-white/5">
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-0.5">WCA ID</p>
                    <a href={`https://www.worldcubeassociation.org/persons/${userProfile.wcaId}`} target="_blank" rel="noopener noreferrer" className="text-lg font-mono font-bold text-blue-400 hover:text-blue-300 transition-colors">
                      {userProfile.wcaId}
                    </a>
                  </div>
                )}
             </div>
          </div>

          {/* Stats Grid - Compact */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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

          {/* Main Content Area */}
          <Tabs defaultValue="overview" className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-1">
              <TabsList className="bg-transparent p-0 h-auto gap-6">
                {[
                  { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
                  { id: 'results', icon: Activity, label: 'Results' },
                  { id: 'payments', icon: CreditCard, label: 'Payments' },
                  { id: 'edit', icon: Settings, label: 'Settings' }
                ].map((tab) => (
                  <TabsTrigger 
                    key={tab.id}
                    value={tab.id} 
                    className="relative px-0 py-3 bg-transparent hover:text-zinc-200 text-zinc-500 data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <tab.icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="overview" className="space-y-6 focus-visible:outline-none animate-in fade-in-50 duration-500 slide-in-from-bottom-2">
              <Card className="bg-zinc-900/20 border-white/5 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                   {dataLoading ? (
                    <div className="py-8 text-center text-zinc-500 text-sm">Loading activity...</div>
                  ) : competitions.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-800/50 flex items-center justify-center mx-auto mb-3">
                        <Trophy className="w-5 h-5 text-zinc-500" />
                      </div>
                      <h3 className="text-sm font-medium text-white mb-1">No competitions yet</h3>
                      <p className="text-zinc-500 text-xs mb-4">Join a competition to start your journey!</p>
                      <Link href="/competitions">
                        <Button variant="outline" size="sm" className="border-white/10 hover:bg-white/5 hover:text-white h-8 text-xs">
                          Browse Competitions
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {competitions.slice(0, 5).map(comp => (
                        <div key={comp.id} className="group flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5 hover:border-white/10 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-md bg-zinc-800/50 flex items-center justify-center text-sm">
                              🏆
                            </div>
                            <div>
                              <p className="font-medium text-white text-sm group-hover:text-blue-400 transition-colors">{comp.name}</p>
                              <p className="text-xs text-zinc-500">{formatDate(comp.startDate)} • {comp.city || 'Online'}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/competition/${comp.id}`)} className="text-zinc-500 hover:text-white h-7 text-xs">
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="edit" className="focus-visible:outline-none animate-in fade-in-50 duration-500 slide-in-from-bottom-2">
              <Card className="bg-zinc-900/20 border-white/5 backdrop-blur-sm max-w-2xl">
                <CardHeader>
                  <CardTitle className="text-lg">Edit Profile</CardTitle>
                  <CardDescription>Update your personal information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                   {message.text && (
                    <div className={`p-3 rounded-md border text-xs font-medium ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                      {message.text}
                    </div>
                  )}
                  
                  <div className="grid gap-5">
                    <div className="grid gap-2">
                      <Label htmlFor="displayName" className="text-xs font-medium text-zinc-400">Display Name</Label>
                      <Input
                        id="displayName"
                        value={formData.displayName}
                        onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                        className="bg-black/40 border-white/10 focus:border-blue-500/50 h-9 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="grid gap-2">
                        <Label htmlFor="username" className="text-xs font-medium text-zinc-400">Username</Label>
                        <Input
                          id="username"
                          value={formData.username}
                          onChange={(e) => setFormData({...formData, username: e.target.value})}
                          className="bg-black/40 border-white/10 focus:border-blue-500/50 h-9 text-sm"
                        />
                      </div>
                      
                      <div className="grid gap-2">
                        <Label htmlFor="wcaId" className="text-xs font-medium text-zinc-400">WCA ID</Label>
                        <Input
                          id="wcaId"
                          value={formData.wcaId}
                          onChange={(e) => setFormData({...formData, wcaId: e.target.value})}
                          placeholder="2024ABCD01"
                          className="bg-black/40 border-white/10 focus:border-blue-500/50 h-9 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="country" className="text-xs font-medium text-zinc-400">Country</Label>
                      <Select value={formData.country} onValueChange={(value) => setFormData({...formData, country: value})}>
                        <SelectTrigger className="bg-black/40 border-white/10 focus:border-blue-500/50 h-9 text-sm">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/10">
                          {COUNTRIES.map(country => (
                            <SelectItem key={country} value={country} className="focus:bg-zinc-800 text-zinc-300 text-sm">
                              {country}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-md p-3 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Email Address</span>
                        <span className="text-zinc-300 font-mono">{userProfile?.email}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">System ID</span>
                        <span className="text-zinc-300 font-mono">{userProfile?.wcaStyleId}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button 
                      onClick={handleSave} 
                      disabled={saving}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 h-8 text-xs font-medium"
                    >
                      {saving ? (
                        <span className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Saving...</span>
                      ) : (
                        <span className="flex items-center gap-2"><Save className="w-3.5 h-3.5" /> Save Changes</span>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="results" className="focus-visible:outline-none animate-in fade-in-50 duration-500 slide-in-from-bottom-2">
              <Card className="bg-zinc-900/20 border-white/5 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">My Results</CardTitle>
                </CardHeader>
                <CardContent>
                  {!results.length ? (
                    <div className="text-center py-12 text-zinc-500 text-sm">
                      No results found. Compete to earn your first result!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {results.map(result => (
                        <div key={result.id} className="p-4 rounded-lg bg-black/40 border border-white/5 hover:border-blue-500/30 transition-all group relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          
                          <div className="relative z-10">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{getEventIcon(result.eventId)}</span>
                                <div>
                                  <h4 className="font-medium text-zinc-200 text-sm">{getEventName(result.eventId)}</h4>
                                  <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">{result.eventId}</p>
                                </div>
                              </div>
                              <Badge variant="outline" className="border-blue-500/20 text-blue-400 bg-blue-500/5 text-[10px] px-1.5 py-0">
                                Ao5
                              </Badge>
                            </div>
                            
                            <div className="space-y-1 mb-3">
                              <div className="flex justify-between items-end">
                                <span className="text-xs text-zinc-500">Average</span>
                                <span className="text-lg font-bold text-white font-mono">{formatTime(result.average)}</span>
                              </div>
                              <div className="flex justify-between items-end">
                                <span className="text-[10px] text-zinc-600">Best Single</span>
                                <span className="text-xs text-zinc-400 font-mono">{formatTime(result.bestSingle)}</span>
                              </div>
                            </div>

                            {result.times && (
                              <div className="flex gap-0.5 pt-2 border-t border-white/5">
                                {result.times.map((time, i) => (
                                  <div key={i} className="flex-1 h-0.5 rounded-full bg-zinc-800 overflow-hidden">
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

            <TabsContent value="payments" className="focus-visible:outline-none animate-in fade-in-50 duration-500 slide-in-from-bottom-2">
              <Card className="bg-zinc-900/20 border-white/5 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Payment History</CardTitle>
                </CardHeader>
                <CardContent>
                  {!payments.length ? (
                    <div className="text-center py-12 text-zinc-500 text-sm">
                      No payment history available.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {payments.map(payment => (
                        <div key={payment.id} className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${payment.status === 'SUCCESS' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                               {payment.status === 'SUCCESS' ? <Shield className="w-4 h-4" /> : <Award className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="font-medium text-white text-sm">{payment.competitionName || 'Competition Registration'}</p>
                              <p className="text-[10px] text-zinc-500 font-mono">{payment.paymentId || payment.id}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-bold text-white">{payment.currency === 'INR' ? '₹' : '$'}{payment.amount}</p>
                            <p className="text-[10px] text-zinc-500">{formatDate(payment.createdAt)}</p>
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
    </div>
  );
}

export default ProfilePage;