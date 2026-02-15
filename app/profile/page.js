'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Trophy, CreditCard, User, Award, TrendingUp } from 'lucide-react';
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
    <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/10">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">MCUBES</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-gray-400 hover:text-white font-medium transition-colors">Home</Link>
            <Link href="/competitions" className="text-gray-400 hover:text-white font-medium transition-colors">Competitions</Link>
            <Link href="/rankings" className="text-gray-400 hover:text-white font-medium transition-colors">Rankings</Link>
          </nav>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => router.push('/admin')} className="border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20">
                Admin
              </Button>
            )}
            <Button variant="outline" size="sm" className="border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20">
              {userProfile?.displayName || 'Profile'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut()} className="text-gray-400 hover:text-white hover:bg-white/5">Logout</Button>
          </div>
        </div>
      </div>
    </header>
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
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-400 text-xl">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Profile Header - Hero Section */}
        <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 border border-white/10 backdrop-blur-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
          
          <div className="relative py-8 px-6 md:px-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
                <div className="relative w-24 h-24 md:w-28 md:h-28 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl">
                  {userProfile?.photoURL ? (
                    <img src={userProfile.photoURL} alt="" className="w-full h-full rounded-2xl object-cover" />
                  ) : (
                    <User className="w-12 h-12 md:w-14 md:h-14 text-white" />
                  )}
                </div>
              </div>
              
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {userProfile?.displayName || 'User'}
                </h1>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-3">
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 px-3 py-1">
                    {userProfile?.wcaStyleId || 'N/A'}
                  </Badge>
                  {userProfile?.wcaId && (
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 px-3 py-1">
                      WCA: {userProfile.wcaId}
                    </Badge>
                  )}
                  <span className="text-gray-400 flex items-center gap-1">
                    📍 {userProfile?.country || 'Unknown'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  Member since {formatDate(userProfile?.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white/5 border border-white/10 backdrop-blur-xl p-1 w-full md:w-auto">
            <TabsTrigger value="overview" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white text-gray-400">
              Overview
            </TabsTrigger>
            <TabsTrigger value="edit" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white text-gray-400">
              Edit Profile
            </TabsTrigger>
            <TabsTrigger value="results" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white text-gray-400">
              Results
            </TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white text-gray-400">
              Payments
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 backdrop-blur-xl p-6 group hover:from-yellow-500/20 hover:to-orange-500/20 transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/20 rounded-full blur-2xl group-hover:bg-yellow-500/30 transition-all" />
                <Trophy className="h-10 w-10 mb-3 text-yellow-400 relative z-10" />
                <p className="text-4xl font-bold text-white mb-1 relative z-10">{competitions.length}</p>
                <p className="text-gray-400 text-sm relative z-10">Competitions</p>
              </div>
              
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 backdrop-blur-xl p-6 group hover:from-blue-500/20 hover:to-cyan-500/20 transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl group-hover:bg-blue-500/30 transition-all" />
                <Award className="h-10 w-10 mb-3 text-blue-400 relative z-10" />
                <p className="text-4xl font-bold text-white mb-1 relative z-10">{results.length}</p>
                <p className="text-gray-400 text-sm relative z-10">Results</p>
              </div>
              
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 backdrop-blur-xl p-6 group hover:from-purple-500/20 hover:to-pink-500/20 transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl group-hover:bg-purple-500/30 transition-all" />
                <CreditCard className="h-10 w-10 mb-3 text-purple-400 relative z-10" />
                <p className="text-4xl font-bold text-white mb-1 relative z-10">{payments.length}</p>
                <p className="text-gray-400 text-sm relative z-10">Payments</p>
              </div>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-400" />
                  Recent Competitions
                </h3>
              </div>
              <div className="p-6">
                {dataLoading ? (
                  <p className="text-gray-400 text-center py-4">Loading...</p>
                ) : competitions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-4">No competitions yet</p>
                    <Button 
                      onClick={() => router.push('/competitions')}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/30"
                    >
                      Browse Competitions
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {competitions.slice(0, 5).map(comp => (
                      <div key={comp.id} className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-all group">
                        <div>
                          <p className="font-medium text-white group-hover:text-blue-400 transition-colors">{comp.name}</p>
                          <p className="text-sm text-gray-500">{formatDate(comp.startDate)}</p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => router.push(`/competition/${comp.id}`)}
                          className="border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                        >
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Edit Profile Tab */}
          <TabsContent value="edit">
            <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                <h3 className="text-xl font-bold text-white">Edit Profile</h3>
              </div>
              <div className="p-6 space-y-5">
                {message.text && (
                  <div className={`p-4 rounded-lg border ${message.type === 'success' ? 'bg-green-500/10 text-green-300 border-green-500/30' : 'bg-red-500/10 text-red-300 border-red-500/30'}`}>
                    {message.text}
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label className="text-gray-300">Display Name</Label>
                  <Input
                    value={formData.displayName}
                    onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Username</Label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">WCA ID (Optional)</Label>
                  <Input
                    value={formData.wcaId}
                    onChange={(e) => setFormData({...formData, wcaId: e.target.value})}
                    placeholder="e.g., 2019JOHN01"
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                  />
                  <p className="text-xs text-gray-500">Enter your official WCA ID if you have one</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Country</Label>
                  <Select value={formData.country} onValueChange={(value) => setFormData({...formData, country: value})}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white focus:border-blue-500/50 focus:ring-blue-500/20">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-white/10">
                      {COUNTRIES.map(country => (
                        <SelectItem key={country} value={country} className="text-white focus:bg-white/10">{country}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-white/5 border border-white/10 p-4 rounded-lg space-y-2 text-sm">
                  <p className="text-gray-300"><strong>Email:</strong> {userProfile?.email} <span className="text-gray-500">(Read-only)</span></p>
                  <p className="text-gray-300"><strong>MCUBES ID:</strong> {userProfile?.wcaStyleId} <span className="text-gray-500">(Read-only)</span></p>
                </div>

                <Button 
                  onClick={handleSave} 
                  disabled={saving} 
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/30"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results">
            <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Award className="h-5 w-5 text-blue-400" />
                  My Results
                </h3>
              </div>
              <div className="p-6">
                {results.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No results yet. Compete in a competition to see your results!</p>
                ) : (
                  <div className="space-y-4">
                    {results.map(result => (
                      <div key={result.id} className="p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-semibold text-white flex items-center gap-2">
                            {getEventIcon(result.eventId)} {getEventName(result.eventId)}
                          </p>
                          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                            Ao5: {formatTime(result.average)}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-400 mb-2">Best: {formatTime(result.bestSingle)}</p>
                        {result.times && (
                          <div className="flex flex-wrap gap-2">
                            {result.times.map((time, i) => (
                              <span key={i} className="text-xs bg-white/10 px-3 py-1 rounded border border-white/20 text-gray-300">
                                {formatTime(time)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-purple-400" />
                  My Payment History
                </h3>
              </div>
              <div className="p-6">
                {payments.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No payment history</p>
                ) : (
                  <div className="space-y-3">
                    {payments.map(payment => (
                      <div key={payment.id} className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all">
                        <div>
                          <p className="font-medium text-white">Payment #{payment.paymentId?.slice(-8) || 'N/A'}</p>
                          <p className="text-sm text-gray-500">{formatDate(payment.createdAt)}</p>
                          <p className="text-sm text-gray-400">{payment.competitionName || 'Competition'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white text-lg">{payment.currency === 'INR' ? '₹' : '$'}{payment.amount || 0}</p>
                          <Badge className="bg-green-500/20 text-green-300 border-green-500/30 mt-1">
                            {payment.status || 'SUCCESS'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default ProfilePage;