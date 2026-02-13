'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Calendar, Users, Search, Trophy } from 'lucide-react';
import { getEventName, getEventIcon } from '@/lib/wcaEvents';

function CompetitionsPage() {
  const router = useRouter();
  const [competitions, setCompetitions] = useState([]);
  const [filteredComps, setFilteredComps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchCompetitions();
  }, []);

  useEffect(() => {
    filterCompetitions();
  }, [competitions, searchTerm, statusFilter]);

  async function fetchCompetitions() {
    try {
      const compsRef = collection(db, 'competitions');
      const q = query(compsRef, orderBy('startDate', 'desc'));
      const snapshot = await getDocs(q);
      
      const compsData = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const now = new Date();
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        
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
      
      setCompetitions(compsData);
      setFilteredComps(compsData);
    } catch (error) {
      console.error('Failed to fetch competitions:', error);
    } finally {
      setLoading(false);
    }
  }

  function filterCompetitions() {
    let filtered = competitions;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(comp => comp.status === statusFilter.toUpperCase());
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(comp => 
        comp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comp.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredComps(filtered);
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

  const getCurrencySymbol = (currency) => {
    return currency === 'INR' ? '₹' : '$';
  };

  const upcomingComps = filteredComps.filter(c => c.status === 'UPCOMING');
  const liveComps = filteredComps.filter(c => c.status === 'LIVE');
  const endedComps = filteredComps.filter(c => c.status === 'ENDED');

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading competitions...</div>
      </div>
    );
  }

  const CompetitionCard = ({ comp }) => (
    <Card
      className="bg-gray-800 border-gray-700 hover:border-blue-500 transition-colors cursor-pointer"
      onClick={() => router.push(`/competition/${comp.id}`)}
    >
      <CardHeader>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <CardTitle className="text-xl text-white mb-2">{comp.name}</CardTitle>
            <CardDescription className="text-gray-400">
              {comp.description && <p className="mb-2">{comp.description.substring(0, 100)}{comp.description.length > 100 && '...'}</p>}
              <div className="flex items-center gap-2 mt-2">
                <Calendar className="h-4 w-4" />
                {formatDate(comp.startDate)} - {formatDate(comp.endDate)}
              </div>
            </CardDescription>
          </div>
          <Badge className={getStatusColor(comp.status)}>
            {comp.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-3">
          {comp.events?.slice(0, 5).map(eventId => (
            <Badge key={eventId} variant="outline" className="border-gray-600">
              {getEventIcon(eventId)} {getEventName(eventId)}
            </Badge>
          ))}
          {comp.events?.length > 5 && (
            <Badge variant="outline" className="border-gray-600">+{comp.events.length - 5} more</Badge>
          )}
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-gray-400">
            <span>{comp.events?.length || 0} events</span>
            <span>•</span>
            <span>{comp.solveLimit} solves</span>
          </div>
          <Badge className={comp.type === 'FREE' ? 'bg-green-600' : 'bg-yellow-600'}>
            {comp.type === 'FREE' ? 'FREE' : `${getCurrencySymbol(comp.currency)}${comp.flatPrice || comp.basePrice}`}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/')}
          className="mb-6 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="h-10 w-10 text-blue-500" />
            <div>
              <h1 className="text-4xl font-bold">All Competitions</h1>
              <p className="text-gray-400">Browse and join speedcubing competitions</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search competitions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-green-500">{liveComps.length}</p>
                <p className="text-gray-400 text-sm">Live Now</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-yellow-500">{upcomingComps.length}</p>
                <p className="text-gray-400 text-sm">Upcoming</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-gray-500">{endedComps.length}</p>
                <p className="text-gray-400 text-sm">Ended</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-blue-500">{competitions.length}</p>
                <p className="text-gray-400 text-sm">Total</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="space-y-6" onValueChange={setStatusFilter}>
          <TabsList className="bg-gray-800 border-gray-700">
            <TabsTrigger value="all">All ({competitions.length})</TabsTrigger>
            <TabsTrigger value="live">Live ({liveComps.length})</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming ({upcomingComps.length})</TabsTrigger>
            <TabsTrigger value="ended">Ended ({endedComps.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {filteredComps.length === 0 ? (
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="py-12 text-center text-gray-400">
                  No competitions found
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredComps.map(comp => <CompetitionCard key={comp.id} comp={comp} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="live">
            {liveComps.length === 0 ? (
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="py-12 text-center text-gray-400">
                  No live competitions right now
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {liveComps.map(comp => <CompetitionCard key={comp.id} comp={comp} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upcoming">
            {upcomingComps.length === 0 ? (
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="py-12 text-center text-gray-400">
                  No upcoming competitions
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {upcomingComps.map(comp => <CompetitionCard key={comp.id} comp={comp} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ended">
            {endedComps.length === 0 ? (
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="py-12 text-center text-gray-400">
                  No ended competitions
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {endedComps.map(comp => <CompetitionCard key={comp.id} comp={comp} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default CompetitionsPage;
