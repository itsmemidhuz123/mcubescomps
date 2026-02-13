'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, Users, Timer, LogOut, User, Shield } from 'lucide-react';
import { getEventName, getEventIcon } from '@/lib/wcaEvents';

function HomePage() {
  const { user, userProfile, loading, signOut, isAdmin } = useAuth();
  const router = useRouter();
  const [competitions, setCompetitions] = useState([]);
  const [loadingComps, setLoadingComps] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchCompetitions();
    }
  }, [user]);

  async function fetchCompetitions() {
    try {
      const compsRef = collection(db, 'competitions');
      // Simple query first - no ordering to avoid index requirements
      const snapshot = await getDocs(compsRef);
      
      const compsData = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const now = new Date();
        const start = data.startDate ? new Date(data.startDate) : new Date();
        const end = data.endDate ? new Date(data.endDate) : new Date();
        
        let status = 'UPCOMING';
        if (now >= start && now <= end) {
          status = 'LIVE';
        } else if (now > end) {
          status = 'ENDED';
        }
        
        compsData.push({
          id: doc.id,
          ...data,
          status
        });
      });
      
      // Sort client-side to avoid index requirements
      compsData.sort((a, b) => {
        const dateA = a.startDate ? new Date(a.startDate) : new Date(0);
        const dateB = b.startDate ? new Date(b.startDate) : new Date(0);
        return dateB - dateA;
      });
      
      setCompetitions(compsData);
    } catch (error) {
      console.error('Failed to fetch competitions:', error);
      // Show empty state on error instead of crashing
      setCompetitions([]);
    } finally {
      setLoadingComps(false);
    }
  }

  const handleLogout = async () => {
    await signOut();
    router.push('/auth/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'UPCOMING': return 'bg-yellow-500';
      case 'LIVE': return 'bg-green-500';
      case 'ENDED': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-800/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-blue-500" />
              <div>
                <h1 className="text-2xl font-bold">MCUBES</h1>
                <p className="text-xs text-gray-400">Online Speedcubing Competitions</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {userProfile?.photoURL && (
                <img src={userProfile.photoURL} alt={userProfile.displayName} className="h-10 w-10 rounded-full" />
              )}
              <div className="text-right">
                <p className="font-semibold">{userProfile?.displayName}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-400">{userProfile?.wcaStyleId}</p>
                  {isAdmin && (
                    <Badge className="bg-purple-600 text-xs">Admin</Badge>
                  )}
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => router.push('/profile')}
                className="border-gray-600 hover:bg-gray-700"
              >
                <User className="h-4 w-4" />
              </Button>
              {isAdmin && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => router.push('/admin')}
                  className="border-purple-600 hover:bg-purple-700"
                >
                  <Shield className="h-4 w-4" />
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleLogout}
                className="border-gray-600 hover:bg-gray-700"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-5xl font-bold mb-4">
            Welcome to <span className="text-blue-500">MCUBES</span>
          </h2>
          <p className="text-xl text-gray-400 mb-6">
            Compete in official-style online speedcubing competitions
          </p>
          <div className="flex justify-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span>WCA-Style Format</span>
            </div>
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-blue-500" />
              <span>Live Timer</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-500" />
              <span>Global Leaderboards</span>
            </div>
          </div>
        </div>

        {/* Competitions Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-3xl font-bold">Competitions</h3>
            <Button
              onClick={() => router.push('/competitions')}
              variant="outline"
              className="border-blue-600 hover:bg-blue-700"
            >
              View All
            </Button>
          </div>

          {loadingComps ? (
            <div className="text-center py-12 text-gray-400">Loading competitions...</div>
          ) : competitions.length === 0 ? (
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="py-12 text-center text-gray-400">
                No competitions yet. {isAdmin && 'Create your first competition in the admin panel!'}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {competitions.slice(0, 6).map(comp => (
                <Card
                  key={comp.id}
                  className="bg-gray-800 border-gray-700 hover:border-blue-500 transition-colors cursor-pointer"
                  onClick={() => router.push(`/competition/${comp.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getEventIcon(comp.eventType)}</span>
                        <CardTitle className="text-xl text-white">{comp.name}</CardTitle>
                      </div>
                      <Badge className={getStatusColor(comp.status)}>
                        {comp.status}
                      </Badge>
                    </div>
                    <CardDescription className="text-gray-400">
                      <div className="flex items-center gap-2 mt-2">
                        <Calendar className="h-4 w-4" />
                        {formatDate(comp.startDate)} - {formatDate(comp.endDate)}
                      </div>
                      <div className="mt-2 text-sm">
                        {getEventName(comp.eventType)} • {comp.solveLimit} solves
                      </div>
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HomePage;
