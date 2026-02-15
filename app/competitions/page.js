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
import { Trophy, Calendar, Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import Link from 'next/link';

function CompetitionsPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [competitions, setCompetitions] = useState([]);
  const [filteredComps, setFilteredComps] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompetitions();
  }, [isAdmin]);

  useEffect(() => {
    filterCompetitions();
  }, [competitions, filter, searchQuery]);

  async function fetchCompetitions() {
    try {
      const compsRef = collection(db, 'competitions');
      const snapshot = await getDocs(compsRef);
      let compsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter out unpublished competitions for non-admin users
      if (!isAdmin) {
        compsData = compsData.filter(comp => comp.published !== false);
      }

      // Sort by date (newest first)
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
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Competitions</h1>
            <p className="text-gray-500 mt-1">Discover upcoming official-style online events.</p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full md:w-64 bg-white"
                />
             </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex overflow-x-auto pb-4 mb-6 gap-2 no-scrollbar">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
              className={`rounded-full px-6 ${filter === 'all' ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-white border-gray-200'}`}
              size="sm"
            >
              All Events
            </Button>
            <Button
              variant={filter === 'upcoming' ? 'default' : 'outline'}
              onClick={() => setFilter('upcoming')}
              className={`rounded-full px-6 ${filter === 'upcoming' ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-white border-gray-200'}`}
              size="sm"
            >
              Upcoming
            </Button>
            <Button
              variant={filter === 'completed' ? 'default' : 'outline'}
              onClick={() => setFilter('completed')}
              className={`rounded-full px-6 ${filter === 'completed' ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-white border-gray-200'}`}
              size="sm"
            >
              Completed
            </Button>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
             {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse"></div>
             ))}
          </div>
        ) : filteredComps.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200 border-dashed">
             <div className="text-4xl mb-4">🔍</div>
             <h3 className="text-lg font-medium text-gray-900 mb-1">No competitions found</h3>
             <p className="text-gray-500">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Upcoming Competitions */}
            {upcomingComps.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-6">
                  <div className="h-6 w-1 bg-green-500 rounded-full"></div>
                  <h2 className="text-xl font-bold text-gray-900">Active & Upcoming</h2>
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
                <div className="flex items-center gap-2 mb-6">
                  <div className="h-6 w-1 bg-gray-300 rounded-full"></div>
                  <h2 className="text-xl font-bold text-gray-900">Past Events</h2>
                </div>
                
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {pastComps.map(comp => (
                    <CompetitionCard key={comp.id} comp={comp} router={router} isPast />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CompetitionCard({ comp, router, isPast = false }) {
  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Get registration status
  const getRegStatus = () => {
    const now = new Date();
    const regOpen = comp.registrationOpenDate ? new Date(comp.registrationOpenDate) : null;
    const regClose = comp.registrationCloseDate ? new Date(comp.registrationCloseDate) : null;

    if (!regOpen || !regClose) {
      // Legacy: no registration dates set
      return { status: 'open', label: 'OPEN', className: 'bg-blue-100 text-blue-700' };
    }
    
    if (now < regOpen) {
      return { status: 'not_opened', label: 'REG SOON', className: 'bg-orange-100 text-orange-700' };
    }
    
    if (now > regClose) {
      return { status: 'closed', label: 'REG CLOSED', className: 'bg-red-100 text-red-700' };
    }
    
    return { status: 'open', label: 'OPEN', className: 'bg-blue-100 text-blue-700' };
  };

  const regStatus = getRegStatus();

  return (
    <Card 
      className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden rounded-xl"
    >
      <CardContent className="p-0">
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
             <div className="flex flex-col">
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
                   {formatDate(comp.competitionStartDate || comp.startDate)}
                </span>
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight">
                  {comp.name}
                </h3>
             </div>
             {isPast ? (
                <Badge variant="secondary" className="bg-gray-100 text-gray-500">ENDED</Badge>
             ) : (
                <Badge className={`${regStatus.className} border-none shadow-none`}>{regStatus.label}</Badge>
             )}
          </div>
          
          <div className="flex flex-wrap gap-1.5 mb-6">
            {(comp.events || []).slice(0, 5).map(eventId => (
               <span key={eventId} className="px-2 py-1 bg-gray-50 border border-gray-100 rounded text-xs text-gray-600 font-medium">
                  {eventId}
               </span>
            ))}
             {(comp.events || []).length > 5 && (
               <span className="px-2 py-1 bg-gray-50 border border-gray-100 rounded text-xs text-gray-500 font-medium">
                  +{comp.events.length - 5}
               </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 bg-white hover:bg-gray-50 border-gray-200 text-gray-700"
              onClick={() => router.push(isPast ? `/leaderboard/${comp.id}` : `/competition/${comp.id}`)}
            >
              {isPast ? 'Results' : 'Details'}
            </Button>
            {!isPast && (
               <Button 
                  size="sm" 
                  className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                  onClick={() => router.push(`/competition/${comp.id}`)}
                  disabled={regStatus.status === 'closed'}
               >
                  Register
               </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default CompetitionsPage;
