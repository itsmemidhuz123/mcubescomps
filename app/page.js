'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, Users, Timer, Zap, Target, Award, ChevronRight, Box } from 'lucide-react';
import { getEventName } from '@/lib/wcaEvents';
import EventIcon from '@/lib/EventIcon';
import Link from 'next/link';

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
      case 'UPCOMING': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
      case 'LIVE': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'ENDED': return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400';
      default: return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
    }
  };

  const featuredCompetitions = competitions.filter(c => c.status !== 'ENDED').slice(0, 3);

  return (
    <div className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950/50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#3f3f46_1px,transparent_1px)] [background-size:16px_16px] opacity-25"></div>
        
        <div className="container mx-auto px-4 py-20 relative max-w-6xl">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-950/50 px-4 py-1.5 rounded-full mb-8 border border-blue-100 dark:border-blue-900/50">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-500"></span>
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Official Style Online Competitions</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-zinc-900 dark:text-white mb-6 tracking-tight">
              Master the Cube.<br/>
              <span className="text-blue-600 dark:text-blue-400">Compete Globally.</span>
            </h1>
            
            <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Join a thriving community of speedcubers. Participate in live events, track your official-style PRs, and climb the global leaderboards.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                size="lg"
                onClick={() => router.push('/competitions')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-12 text-base shadow-lg shadow-blue-600/20 w-full sm:w-auto"
              >
                Browse Competitions
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => router.push('/rankings')}
                className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-8 h-12 text-base w-full sm:w-auto"
              >
                View Leaderboards
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-zinc-900 dark:text-white mb-1">{stats.upcomingEvents}</div>
              <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Upcoming Events</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-zinc-900 dark:text-white mb-1">{stats.totalCompetitions}</div>
              <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Competitions</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-zinc-900 dark:text-white mb-1">{stats.totalCompetitors}</div>
              <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Competitors</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-zinc-900 dark:text-white mb-1">{stats.totalSolves}</div>
              <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Total Solves</div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Competitions */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Featured Competitions</h2>
              <p className="text-zinc-500 dark:text-zinc-400 mt-1">Don&apos;t miss these upcoming events</p>
            </div>
            <Button 
              variant="outline"
              onClick={() => router.push('/competitions')}
              className="hidden md:flex gap-2 border-zinc-200 dark:border-zinc-700"
            >
              View all
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {loadingComps ? (
            <div className="grid gap-6 md:grid-cols-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : featuredCompetitions.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-50 dark:bg-zinc-800 mb-4">
                <Box className="w-8 h-8 text-zinc-400" />
              </div>
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-1">No active competitions</h3>
              <p className="text-zinc-500 dark:text-zinc-400">Check back later for new events.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredCompetitions.map(comp => (
                <Card
                  key={comp.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group rounded-xl overflow-hidden"
                  onClick={() => router.push(`/competition/${comp.id}`)}
                >
                  <CardContent className="p-0">
                    <div className="p-6">
                      <div className="flex flex-wrap gap-2 mb-4">
                        {comp.status === 'LIVE' && <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/40 border-none shadow-none">LIVE</Badge>}
                        {comp.status === 'UPCOMING' && <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/40 border-none shadow-none">UPCOMING</Badge>}
                        {comp.type === 'FREE' && <Badge className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 border-none shadow-none">FREE</Badge>}
                      </div>
                      
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                        {comp.name}
                      </h3>
                      
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mb-4 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {formatDate(comp.startDate)}
                      </p>
                      
                      <div className="flex flex-wrap gap-2 mb-6">
                        {(comp.events || []).slice(0, 4).map(eventId => (
                          <span key={eventId} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs font-medium" title={eventId}>
                            <EventIcon eventId={eventId} size={20} />
                          </span>
                        ))}
                        {(comp.events || []).length > 4 && (
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-xs font-medium">
                            +{comp.events.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                         {comp.status === 'LIVE' ? 'Compete now' : 'Registration open'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          <div className="mt-8 md:hidden">
             <Button variant="outline" className="w-full border-zinc-200 dark:border-zinc-700" onClick={() => router.push('/competitions')}>View all competitions</Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-zinc-900 dark:bg-black text-white">
        <div className="container mx-auto px-4 max-w-6xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to set your new PR?</h2>
            <p className="text-zinc-400 text-lg mb-8 max-w-2xl mx-auto">
              Join thousands of cubers competing in our daily and weekly events. Free registration, official WCA events, and instant rankings.
            </p>
            <Button 
              size="lg"
              onClick={() => router.push('/auth/register')}
              className="bg-white dark:bg-zinc-100 text-zinc-900 dark:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-200 px-8 h-12 text-base font-semibold"
            >
              Get Started for Free
            </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                M
              </div>
              <span className="text-lg font-bold text-zinc-900 dark:text-white">MCUBES</span>
            </div>
            <div className="flex gap-8 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              <Link href="/competitions" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Competitions</Link>
              <Link href="/rankings" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Rankings</Link>
              <Link href="/timer" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Timer</Link>
            </div>
            <p className="text-zinc-400 dark:text-zinc-500 text-sm">
              © 2026 MCUBES. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;