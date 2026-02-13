'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Trophy, Calendar, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

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
            <Link href="/competitions" className="text-blue-600 font-semibold">Competitions</Link>
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
                <Button variant="outline" size="sm" onClick={() => router.push('/profile')}>
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

function CompetitionsPage() {
  const router = useRouter();
  const [competitions, setCompetitions] = useState([]);
  const [filteredComps, setFilteredComps] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompetitions();
  }, []);

  useEffect(() => {
    filterCompetitions();
  }, [competitions, filter, searchQuery]);

  async function fetchCompetitions() {
    try {
      const compsRef = collection(db, 'competitions');
      const snapshot = await getDocs(compsRef);
      
      const compsData = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Filter out unpublished competitions for non-admin users
        if (data.published === false && !isAdmin) {
          return;
        }
        
        const now = new Date();
        const start = data.competitionStartDate || data.startDate;
        const end = data.competitionEndDate || data.endDate;
        const startDate = start ? new Date(start) : new Date();
        const endDate = end ? new Date(end) : new Date();
        
        let status = 'UPCOMING';
        if (now >= startDate && now <= endDate) status = 'LIVE';
        else if (now > endDate) status = 'PAST';
        
        compsData.push({ id: doc.id, ...data, status });
      });
      
      compsData.sort((a, b) => {
        const dateA = a.competitionStartDate || a.startDate ? new Date(a.competitionStartDate || a.startDate) : new Date(0);
        const dateB = b.competitionStartDate || b.startDate ? new Date(b.competitionStartDate || b.startDate) : new Date(0);
        return dateB - dateA;
      });
      
      setCompetitions(compsData);
    } catch (error) {
      console.error('Failed to fetch competitions:', error);
    } finally {
      setLoading(false);
    }
  }

  function filterCompetitions() {
    let filtered = [...competitions];
    
    if (filter === 'upcoming') {
      filtered = filtered.filter(c => c.status === 'UPCOMING' || c.status === 'LIVE');
    } else if (filter === 'completed') {
      filtered = filtered.filter(c => c.status === 'PAST');
    }
    
    if (searchQuery) {
      filtered = filtered.filter(c => 
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.events || []).some(e => e.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    setFilteredComps(filtered);
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const upcomingComps = filteredComps.filter(c => c.status === 'UPCOMING' || c.status === 'LIVE');
  const pastComps = filteredComps.filter(c => c.status === 'PAST');

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">All Competitions</h1>
          <p className="text-gray-500">Swipe/scroll to explore — filter by upcoming or completed.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="flex bg-white rounded-full p-1 shadow-sm border border-gray-100">
            <button
              onClick={() => setFilter('all')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                filter === 'all' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('upcoming')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                filter === 'upcoming' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                filter === 'completed' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Completed
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Search by name / ID / events / mode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 py-6 bg-white border-gray-200 rounded-xl"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading competitions...</div>
        ) : filteredComps.length === 0 ? (
          <Card className="bg-white border-dashed">
            <CardContent className="py-16 text-center">
              <div className="text-6xl mb-4">🧊</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No competitions found</h3>
              <p className="text-gray-500">Try adjusting your filters or check back later.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Upcoming Competitions */}
            {upcomingComps.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Upcoming Competitions</h2>
                    <p className="text-gray-500 text-sm">Nearest first</p>
                  </div>
                </div>
                
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {upcomingComps.map(comp => (
                    <CompetitionCard key={comp.id} comp={comp} router={router} />
                  ))}
                </div>
              </section>
            )}

            {/* Past Competitions */}
            {pastComps.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Past Competitions</h2>
                    <p className="text-gray-500 text-sm">Latest → Oldest</p>
                  </div>
                </div>
                
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {pastComps.map(comp => (
                    <CompetitionCard key={comp.id} comp={comp} router={router} isPast />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* CTA Section */}
      <section className="py-16 mt-8">
        <div className="container mx-auto px-4">
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 rounded-3xl p-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Ready to compete?</h2>
                <p className="text-blue-100">Register early and lock your slots before they fill.</p>
              </div>
              <Button 
                size="lg"
                onClick={() => router.push('/auth/register')}
                className="bg-white text-blue-600 hover:bg-blue-50 px-8"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function CompetitionCard({ comp, router, isPast = false }) {
  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  // Get registration status
  const getRegStatus = () => {
    const now = new Date();
    const regOpen = comp.registrationOpenDate ? new Date(comp.registrationOpenDate) : null;
    const regClose = comp.registrationCloseDate ? new Date(comp.registrationCloseDate) : null;

    if (!regOpen || !regClose) {
      // Legacy: no registration dates set
      return { status: 'open', label: 'REG OPEN', className: 'bg-blue-100 text-blue-700' };
    }
    
    if (now < regOpen) {
      return { status: 'not_opened', label: 'REG SOON', className: 'bg-orange-100 text-orange-700' };
    }
    
    if (now > regClose) {
      return { status: 'closed', label: 'REG CLOSED', className: 'bg-red-100 text-red-700' };
    }
    
    return { status: 'open', label: 'REG OPEN', className: 'bg-blue-100 text-blue-700' };
  };

  const regStatus = getRegStatus();

  return (
    <Card className="bg-white border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="outline" className="bg-gray-50">ONLINE</Badge>
          {isPast ? (
            <Badge className="bg-gray-100 text-gray-600">PAST</Badge>
          ) : (
            <>
              {comp.status === 'LIVE' && <Badge className="bg-green-100 text-green-700">LIVE</Badge>}
              {comp.status === 'UPCOMING' && <Badge className="bg-yellow-100 text-yellow-700">UPCOMING</Badge>}
              <Badge className={regStatus.className}>{regStatus.label}</Badge>
            </>
          )}
          {comp.type === 'PAID' && (
            <Badge className="bg-purple-100 text-purple-700">PAID</Badge>
          )}
          {comp.type === 'FREE' && (
            <Badge className="bg-green-100 text-green-700">FREE</Badge>
          )}
        </div>
        
        <h3 className="text-xl font-bold text-gray-900 mb-2">{comp.name}</h3>
        
        <p className="text-blue-600 font-medium mb-3">
          {formatDate(comp.competitionStartDate || comp.startDate)} - {formatDate(comp.competitionEndDate || comp.endDate)}
        </p>
        
        <p className="text-gray-500 text-sm mb-4">
          Events: {(comp.events || []).join(', ') || 'TBD'}
        </p>
        
        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => router.push(`/competition/${comp.id}`)}
          >
            View details
          </Button>
          {isPast ? (
            <Button 
              size="sm" 
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              onClick={() => router.push(`/leaderboard/${comp.id}`)}
            >
              View Results
            </Button>
          ) : (
            <Button 
              size="sm" 
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              onClick={() => router.push(`/competition/${comp.id}`)}
              disabled={regStatus.status === 'closed'}
            >
              {regStatus.status === 'not_opened' ? 'Coming Soon' : 
               regStatus.status === 'closed' ? 'Closed' : 'Register Now'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default CompetitionsPage;
