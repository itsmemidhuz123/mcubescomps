'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, updateDoc, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Edit2, Save, Trophy, CreditCard, Calendar, User } from 'lucide-react';
import { getEventName, getEventIcon } from '@/lib/wcaEvents';
import Link from 'next/link';

const COUNTRIES = [
  'India', 'United States', 'China', 'United Kingdom', 'Australia',
  'Canada', 'Germany', 'France', 'Japan', 'South Korea', 'Brazil',
  'Russia', 'Italy', 'Spain', 'Netherlands', 'Other'
];

// Header Component
function Header() {
  const { user, userProfile, loading, signOut, isAdmin } = useAuth();
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
            <Link href="/timer" className="text-gray-600 hover:text-gray-900 font-medium">Timer</Link>
          </nav>

          <div className="flex items-center gap-3">
            {!loading && user ? (
              <>
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => router.push('/admin')} className="border-purple-200 text-purple-600">
                    Admin
                  </Button>
                )}
                <Button variant="outline" size="sm" className="border-blue-200 text-blue-600">
                  {userProfile?.displayName || 'Profile'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => signOut()}>Logout</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => router.push('/auth/login')}>Sign In</Button>
                <Button onClick={() => router.push('/auth/register')} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function ProfilePage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    country: ''
  });
  const [competitions, setCompetitions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [results, setResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

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
        country: userProfile.country || ''
      });
      fetchUserData();
    }
  }, [userProfile]);

  async function fetchUserData() {
    if (!user) return;
    
    try {
      // Fetch registrations
      const registrationsQuery = query(
        collection(db, 'registrations'),
        where('userId', '==', user.uid)
      );
      const regSnapshot = await getDocs(registrationsQuery);
      const compIds = regSnapshot.docs.map(doc => doc.data().competitionId);
      
      // Fetch competition details
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

      // Fetch payments
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('userId', '==', user.uid)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      setPayments(paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch results
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
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: formData.displayName,
        username: formData.username,
        country: formData.country
      });
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  const formatTime = (ms) => {
    if (!ms || ms === Infinity) return '-';
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

  // Show loading while auth is being checked
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-500 text-xl">Loading...</div>
        </div>
      </div>
    );
  }

  // Don't render if not logged in (will redirect)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Profile Header */}
        <Card className="mb-6">
          <CardContent className="py-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                {userProfile?.photoURL ? (
                  <img src={userProfile.photoURL} alt="" className="w-full h-full rounded-full" />
                ) : (
                  <User className="w-10 h-10 text-white" />
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900">{userProfile?.displayName || 'User'}</h1>
                <div className="flex items-center gap-3 mt-2">
                  <Badge className="bg-blue-100 text-blue-700">{userProfile?.wcaStyleId || 'N/A'}</Badge>
                  <span className="text-gray-500">📍 {userProfile?.country || 'Unknown'}</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  Member since {formatDate(userProfile?.createdAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white border">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="edit">Edit Profile</TabsTrigger>
            <TabsTrigger value="results">My Results</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="py-6 text-center">
                  <Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                  <p className="text-3xl font-bold text-gray-900">{competitions.length}</p>
                  <p className="text-gray-500 text-sm">Competitions</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-6 text-center">
                  <p className="text-3xl font-bold text-gray-900">{results.length}</p>
                  <p className="text-gray-500 text-sm">Results</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-6 text-center">
                  <p className="text-3xl font-bold text-gray-900">{payments.length}</p>
                  <p className="text-gray-500 text-sm">Payments</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Competitions</CardTitle>
              </CardHeader>
              <CardContent>
                {dataLoading ? (
                  <p className="text-gray-400 text-center py-4">Loading...</p>
                ) : competitions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No competitions yet</p>
                    <Button className="mt-4" onClick={() => router.push('/competitions')}>
                      Browse Competitions
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {competitions.slice(0, 5).map(comp => (
                      <div key={comp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{comp.name}</p>
                          <p className="text-sm text-gray-500">{formatDate(comp.startDate)}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => router.push(`/competition/${comp.id}`)}>
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Edit Profile Tab */}
          <TabsContent value="edit">
            <Card>
              <CardHeader>
                <CardTitle>Edit Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input
                    value={formData.displayName}
                    onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select value={formData.country} onValueChange={(value) => setFormData({...formData, country: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map(country => (
                        <SelectItem key={country} value={country}>{country}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                  <p><strong>Email:</strong> {userProfile?.email} <span className="text-gray-400">(Read-only)</span></p>
                  <p><strong>WCA ID:</strong> {userProfile?.wcaStyleId} <span className="text-gray-400">(Read-only)</span></p>
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results">
            <Card>
              <CardHeader>
                <CardTitle>My Results</CardTitle>
              </CardHeader>
              <CardContent>
                {results.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No results yet. Compete in a competition to see your results!</p>
                ) : (
                  <div className="space-y-4">
                    {results.map(result => (
                      <div key={result.id} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold">
                            {getEventIcon(result.eventId)} {getEventName(result.eventId)}
                          </p>
                          <Badge>Ao5: {formatTime(result.average)}</Badge>
                        </div>
                        <p className="text-sm text-gray-500">Best: {formatTime(result.bestSingle)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle><CreditCard className="inline h-5 w-5 mr-2" />Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No payment history</p>
                ) : (
                  <div className="space-y-3">
                    {payments.map(payment => (
                      <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">Payment #{payment.paymentId?.slice(-8) || 'N/A'}</p>
                          <p className="text-sm text-gray-500">{formatDate(payment.createdAt)}</p>
                        </div>
                        <Badge className="bg-green-100 text-green-700">{payment.status || 'SUCCESS'}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default ProfilePage;
