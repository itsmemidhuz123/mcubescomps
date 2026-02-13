'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Edit2, Save, Trophy, CreditCard, Calendar } from 'lucide-react';
import { getEventName, getEventIcon } from '@/lib/wcaEvents';

const COUNTRIES = [
  'India', 'United States', 'China', 'United Kingdom', 'Australia',
  'Canada', 'Germany', 'France', 'Japan', 'South Korea', 'Brazil',
  'Russia', 'Italy', 'Spain', 'Netherlands', 'Other'
];

function ProfilePage() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    country: ''
  });
  const [competitions, setCompetitions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState({
    totalCompetitions: 0,
    totalEvents: 0,
    bestSingles: {},
    bestAverages: {}
  });

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    
    if (userProfile) {
      setFormData({
        displayName: userProfile.displayName || '',
        username: userProfile.username || '',
        country: userProfile.country || ''
      });
      fetchUserData();
    }
  }, [user, userProfile]);

  async function fetchUserData() {
    try {
      // Fetch competitions user participated in
      const registrationsQuery = query(
        collection(db, 'registrations'),
        where('userId', '==', user.uid)
      );
      const regSnapshot = await getDocs(registrationsQuery);
      const compIds = regSnapshot.docs.map(doc => doc.data().competitionId);
      
      const compData = [];
      for (const compId of compIds) {
        const compDoc = await getDoc(doc(db, 'competitions', compId));
        if (compDoc.exists()) {
          compData.push({ id: compDoc.id, ...compDoc.data() });
        }
      }
      setCompetitions(compData);

      // Fetch payments
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('userId', '==', user.uid)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const paymentsData = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPayments(paymentsData);

      // Fetch results
      const resultsQuery = query(
        collection(db, 'results'),
        where('userId', '==', user.uid)
      );
      const resultsSnapshot = await getDocs(resultsQuery);
      const resultsData = resultsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setResults(resultsData);

      // Calculate stats
      calculateStats(resultsData);
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    }
  }

  function calculateStats(resultsData) {
    const bestSingles = {};
    const bestAverages = {};
    const eventSet = new Set();

    resultsData.forEach(result => {
      eventSet.add(result.eventId);
      
      // Best single
      if (result.bestSingle !== Infinity && result.bestSingle) {
        if (!bestSingles[result.eventId] || result.bestSingle < bestSingles[result.eventId]) {
          bestSingles[result.eventId] = result.bestSingle;
        }
      }

      // Best average
      if (result.average !== 'DNF' && result.average) {
        if (!bestAverages[result.eventId] || result.average < bestAverages[result.eventId]) {
          bestAverages[result.eventId] = result.average;
        }
      }
    });

    setStats({
      totalCompetitions: competitions.length,
      totalEvents: eventSet.size,
      bestSingles,
      bestAverages
    });
  }

  async function handleSave() {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: formData.displayName,
        username: formData.username,
        country: formData.country
      });
      
      alert('Profile updated successfully!');
      setEditing(false);
      window.location.reload();
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile');
    } finally {
      setLoading(false);
    }
  }

  const formatTime = (ms) => {
    if (!ms || ms === Infinity) return '-';
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => router.push('/')}
          className="mb-6 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>

        {/* Profile Header */}
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardContent className="py-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-6">
                {userProfile.photoURL && (
                  <img src={userProfile.photoURL} alt={userProfile.displayName} className="h-24 w-24 rounded-full" />
                )}
                <div>
                  <h1 className="text-3xl font-bold mb-2">{userProfile.displayName}</h1>
                  <div className="space-y-1">
                    <Badge className="bg-blue-600 text-lg px-3 py-1">{userProfile.wcaStyleId}</Badge>
                    <p className="text-gray-400">📍 {userProfile.country}</p>
                    <p className="text-gray-400 text-sm">Member since {formatDate(userProfile.createdAt)}</p>
                  </div>
                </div>
              </div>
              {!editing && (
                <Button onClick={() => setEditing(true)} variant="outline" className="border-blue-600">
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-gray-800 border-gray-700">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="edit">Edit Profile</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="py-6 text-center">
                  <Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                  <p className="text-3xl font-bold">{stats.totalCompetitions}</p>
                  <p className="text-gray-400 text-sm">Competitions</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="py-6 text-center">
                  <p className="text-3xl font-bold">{stats.totalEvents}</p>
                  <p className="text-gray-400 text-sm">Events Competed</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="py-6 text-center">
                  <p className="text-3xl font-bold">{Object.keys(stats.bestSingles).length}</p>
                  <p className="text-gray-400 text-sm">Personal Records</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="py-6 text-center">
                  <p className="text-3xl font-bold">{payments.length}</p>
                  <p className="text-gray-400 text-sm">Paid Competitions</p>
                </CardContent>
              </Card>
            </div>

            {/* Best Singles */}
            {Object.keys(stats.bestSingles).length > 0 && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle>Best Singles</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(stats.bestSingles).map(([eventId, time]) => (
                      <div key={eventId} className="bg-gray-700/50 p-4 rounded-lg">
                        <p className="text-sm text-gray-400 mb-1">
                          {getEventIcon(eventId)} {getEventName(eventId)}
                        </p>
                        <p className="text-2xl font-bold text-blue-400">{formatTime(time)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Best Averages */}
            {Object.keys(stats.bestAverages).length > 0 && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle>Best Averages (Ao5)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(stats.bestAverages).map(([eventId, average]) => (
                      <div key={eventId} className="bg-gray-700/50 p-4 rounded-lg">
                        <p className="text-sm text-gray-400 mb-1">
                          {getEventIcon(eventId)} {getEventName(eventId)}
                        </p>
                        <p className="text-2xl font-bold text-green-400">{formatTime(average)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Competitions */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle>Competition History</CardTitle>
              </CardHeader>
              <CardContent>
                {competitions.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No competitions yet</p>
                ) : (
                  <div className="space-y-3">
                    {competitions.map(comp => (
                      <div key={comp.id} className="bg-gray-700/50 p-4 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{comp.name}</p>
                          <p className="text-sm text-gray-400">{formatDate(comp.startDate)}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/leaderboard/${comp.id}`)}
                          className="border-blue-600"
                        >
                          View Results
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
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle>Edit Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-white">Display Name</Label>
                    <Input
                      value={formData.displayName}
                      onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Username</Label>
                    <Input
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Country</Label>
                    <Select value={formData.country} onValueChange={(value) => setFormData({...formData, country: value})}>
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(country => (
                          <SelectItem key={country} value={country}>{country}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-gray-700/50 p-4 rounded-lg space-y-2">
                    <p className="text-sm text-gray-400"><strong>Email:</strong> {userProfile.email} (Read-only)</p>
                    <p className="text-sm text-gray-400"><strong>WCA ID:</strong> {userProfile.wcaStyleId} (Read-only)</p>
                    <p className="text-sm text-gray-400"><strong>Registration Date:</strong> {formatDate(userProfile.createdAt)} (Read-only)</p>
                  </div>
                </div>

                <Button
                  onClick={handleSave}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 py-6"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle>All Results</CardTitle>
              </CardHeader>
              <CardContent>
                {results.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No results yet</p>
                ) : (
                  <div className="space-y-4">
                    {results.map(result => (
                      <div key={result.id} className="bg-gray-700/50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold">
                            {getEventIcon(result.eventId)} {getEventName(result.eventId)}
                          </p>
                          <Badge className="bg-blue-600">Ao5: {formatTime(result.average)}</Badge>
                        </div>
                        <div className="grid grid-cols-5 gap-2 text-sm">
                          {result.times?.map((time, i) => (
                            <div key={i} className="text-center">
                              <p className="text-gray-400">#{i + 1}</p>
                              <p className="font-mono">{formatTime(time)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle><CreditCard className="inline h-5 w-5 mr-2" />Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No payments yet</p>
                ) : (
                  <div className="space-y-3">
                    {payments.map(payment => (
                      <div key={payment.id} className="bg-gray-700/50 p-4 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-semibold">Payment ID: {payment.paymentId}</p>
                          <p className="text-sm text-gray-400">
                            <Calendar className="inline h-3 w-3 mr-1" />
                            {formatDate(payment.createdAt)}
                          </p>
                        </div>
                        <Badge className="bg-green-600">SUCCESS</Badge>
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
