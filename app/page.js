'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, Users, Timer, Zap, Target, Award, ChevronRight, Cube } from 'lucide-react';
import { getEventName, getEventIcon } from '@/lib/wcaEvents';
import Link from 'next/link';

// Public Header Component
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
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => router.push('/admin')}
                    className="border-purple-200 text-purple-600 hover:bg-purple-50"
                  >
                    Admin
                  </Button>
                )}
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/profile')}
                  className="border-gray-200"
                >
                  {userProfile?.displayName || 'Profile'}
                </Button>
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut()}
                  className="text-gray-500"
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="ghost"
                  onClick={() => router.push('/auth/login')}
                  className="text-gray-600"
                >
                  Sign In
                </Button>
                <Button 
                  onClick={() => router.push('/auth/register')}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90"
                >
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

function HomePage() {
  const router = useRouter();
  const [competitions, setCompetitions] = useState([]);
  const [stats, setStats] = useState({
    upcomingEvents: 0,
    totalCompetitions: 0,
    totalCompetitors: 0,
    totalSolves: 0
  });
  const [loadingComps, setLoadingComps] = useState(true);

  useEffect(() => {
    fetchCompetitions();
    fetchStats();
  }, []);

  async function fetchCompetitions() {
    try {
      const compsRef = collection(db, 'competitions');
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
      
      compsData.sort((a, b) => {
        const dateA = a.startDate ? new Date(a.startDate) : new Date(0);
        const dateB = b.startDate ? new Date(b.startDate) : new Date(0);
        return dateB - dateA;
      });
      
      setCompetitions(compsData);
    } catch (error) {
      console.error('Failed to fetch competitions:', error);
      setCompetitions([]);
    } finally {
      setLoadingComps(false);
    }
  }

  async function fetchStats() {
    try {
      const compsRef = collection(db, 'competitions');
      const compsSnapshot = await getDocs(compsRef);
      
      let upcoming = 0;
      const now = new Date();
      compsSnapshot.forEach(doc => {
        const data = doc.data();
        const start = data.startDate ? new Date(data.startDate) : new Date();
        if (start > now) upcoming++;
      });

      setStats({
        upcomingEvents: upcoming,
        totalCompetitions: compsSnapshot.size,
        totalCompetitors: 0,
        totalSolves: 0
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'UPCOMING': return 'bg-yellow-100 text-yellow-700';
      case 'LIVE': return 'bg-green-100 text-green-700';
      case 'ENDED': return 'bg-gray-100 text-gray-600';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  const featuredCompetitions = competitions.filter(c => c.status !== 'ENDED').slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50"></div>
        <div className="absolute top-20 right-20 w-96 h-96 bg-gradient-to-br from-blue-200/40 to-purple-200/40 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-64 h-64 bg-gradient-to-br from-purple-200/40 to-pink-200/40 rounded-full blur-3xl"></div>
        
        <div className="container mx-auto px-4 py-20 relative">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur px-4 py-2 rounded-full mb-6 shadow-sm">
              <span className="text-sm font-medium text-gray-700">Online Competitions</span>
              <span className="text-gray-400">•</span>
              <span className="text-sm font-medium text-gray-700">Rankings</span>
              <span className="text-gray-400">•</span>
              <span className="text-sm font-medium text-gray-700">Results</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              Master the Cube,<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                Compete Worldwide
              </span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 max-w-2xl">
              Discover competitions, track rankings, and showcase your skills in our online speedcubing platform.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <Button 
                size="lg"
                onClick={() => router.push('/competitions')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 px-8 py-6 text-lg"
              >
                Browse Competitions
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => router.push('/rankings')}
                className="border-gray-300 px-8 py-6 text-lg"
              >
                View Rankings
              </Button>
            </div>
          </div>
          
          {/* 3D Cube Illustration */}
          <div className="absolute right-10 top-1/2 -translate-y-1/2 hidden lg:block">
            <div className="w-80 h-80 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl transform rotate-12 shadow-2xl"></div>
              <div className="absolute inset-4 bg-gradient-to-br from-blue-200/50 to-purple-200/50 rounded-2xl transform rotate-6"></div>
              <div className="absolute inset-8 bg-white/80 rounded-xl flex items-center justify-center shadow-inner">
                <span className="text-8xl">🧊</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-8 border-y border-gray-100 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-4 p-4">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats.upcomingEvents}</div>
                <div className="text-sm text-gray-500">Upcoming Events</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <Trophy className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats.totalCompetitions}</div>
                <div className="text-sm text-gray-500">Total Competitions</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats.totalCompetitors}</div>
                <div className="text-sm text-gray-500">Total Competitors</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                <Timer className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats.totalSolves}</div>
                <div className="text-sm text-gray-500">Total Solves</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Competitions */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Featured Competitions</h2>
              <p className="text-gray-500 mt-1">Don't miss these upcoming events</p>
            </div>
            <Button 
              variant="outline"
              onClick={() => router.push('/competitions')}
              className="hidden md:flex"
            >
              View all competitions
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {loadingComps ? (
            <div className="text-center py-12 text-gray-400">Loading competitions...</div>
          ) : featuredCompetitions.length === 0 ? (
            <Card className="bg-gray-50 border-dashed">
              <CardContent className="py-16 text-center">
                <div className="text-6xl mb-4">🧊</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No competitions yet</h3>
                <p className="text-gray-500">Check back soon for upcoming events!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredCompetitions.map(comp => (
                <Card
                  key={comp.id}
                  className="bg-white border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-300 cursor-pointer group"
                  onClick={() => router.push(`/competition/${comp.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge variant="outline" className="bg-gray-50">ONLINE</Badge>
                      {comp.status === 'LIVE' && <Badge className="bg-green-100 text-green-700">LIVE</Badge>}
                      {comp.status === 'UPCOMING' && <Badge className="bg-yellow-100 text-yellow-700">UPCOMING</Badge>}
                      {comp.type === 'FREE' && <Badge className="bg-blue-100 text-blue-700">FREE</Badge>}
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {comp.name}
                    </h3>
                    
                    <p className="text-blue-600 font-medium mb-3">
                      {formatDate(comp.startDate)} - {formatDate(comp.endDate)}
                    </p>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(comp.events || []).slice(0, 4).map(eventId => (
                        <span key={eventId} className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
                          {eventId}
                        </span>
                      ))}
                      {(comp.events || []).length > 4 && (
                        <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
                          +{comp.events.length - 4}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex gap-3 pt-4 border-t border-gray-100">
                      <Button variant="outline" size="sm" className="flex-1">
                        View Details
                      </Button>
                      {comp.status !== 'ENDED' && (
                        <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700">
                          Register Now
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 rounded-3xl p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
                  Ready to compete?
                </h2>
                <p className="text-blue-100 text-lg">
                  Register early and lock your slots before they fill.
                </p>
              </div>
              <Button 
                size="lg"
                onClick={() => router.push('/auth/register')}
                className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-6 text-lg font-semibold"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">M</span>
              </div>
              <span className="text-xl font-bold">MCUBES</span>
            </div>
            <div className="flex gap-8 text-gray-400">
              <Link href="/competitions" className="hover:text-white">Competitions</Link>
              <Link href="/rankings" className="hover:text-white">Rankings</Link>
              <Link href="/timer" className="hover:text-white">Timer</Link>
            </div>
            <p className="text-gray-500 text-sm">
              © 2026 MCUBES. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
