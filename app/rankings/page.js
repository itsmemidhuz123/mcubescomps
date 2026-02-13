'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Timer, Search } from 'lucide-react';
import Link from 'next/link';
import { WCA_EVENTS } from '@/lib/wcaEvents';

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
            <Link href="/rankings" className="text-blue-600 font-semibold">Rankings</Link>
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

function RankingsPage() {
  const router = useRouter();
  const [selectedEvent, setSelectedEvent] = useState('333');
  const [mode, setMode] = useState('single');
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState('rankings');
  const [stats, setStats] = useState({ competitors: 0, solves: 0, pastComps: 0, events: 7 });
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);

  const events = ['333', '222', '444', 'pyram', 'skewb', 'clock'];

  useEffect(() => {
    fetchStats();
    fetchRankings();
  }, [selectedEvent, mode]);

  async function fetchStats() {
    try {
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      
      const compsRef = collection(db, 'competitions');
      const compsSnapshot = await getDocs(compsRef);
      
      let pastComps = 0;
      const now = new Date();
      compsSnapshot.forEach(doc => {
        const data = doc.data();
        const end = data.endDate ? new Date(data.endDate) : new Date();
        if (end < now) pastComps++;
      });

      setStats({
        competitors: usersSnapshot.size,
        solves: 0,
        pastComps,
        events: events.length
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }

  async function fetchRankings() {
    setLoading(true);
    try {
      // Fetch results for the selected event
      const resultsRef = collection(db, 'results');
      const snapshot = await getDocs(resultsRef);
      
      // Group results by user and keep only their best result for this event
      const userBestResults = new Map();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.eventId === selectedEvent) {
          const userId = data.userId;
          const currentResult = {
            id: doc.id,
            ...data
          };
          
          // Get the relevant time for comparison based on mode
          const currentTime = mode === 'single' 
            ? (currentResult.bestSingle || Infinity) 
            : (currentResult.average || Infinity);
          
          // Check if we already have a result for this user
          const existingResult = userBestResults.get(userId);
          
          if (!existingResult) {
            // First result for this user
            userBestResults.set(userId, currentResult);
          } else {
            // Compare with existing result and keep the better one
            const existingTime = mode === 'single'
              ? (existingResult.bestSingle || Infinity)
              : (existingResult.average || Infinity);
            
            if (currentTime < existingTime) {
              userBestResults.set(userId, currentResult);
            }
          }
        }
      });

      // Convert map to array and sort
      const rankingsData = Array.from(userBestResults.values());
      
      // Sort by best single or average
      rankingsData.sort((a, b) => {
        if (mode === 'single') {
          return (a.bestSingle || Infinity) - (b.bestSingle || Infinity);
        }
        return (a.average || Infinity) - (b.average || Infinity);
      });

      setRankings(rankingsData);
    } catch (error) {
      console.error('Failed to fetch rankings:', error);
      setRankings([]);
    } finally {
      setLoading(false);
    }
  }

  const formatTime = (ms) => {
    if (!ms || ms === Infinity) return '-';
    const seconds = ms / 1000;
    return seconds.toFixed(2);
  };

  // Sample data for display purposes
  const sampleRankings = [
    { rank: 1, name: 'Hari A Deepak', result: '4.73', competition: 'Cubing Clash 2.0' },
    { rank: 2, name: 'Pranav Gadge', result: '5.06', competition: 'Cubing Clash 2.0' },
    { rank: 3, name: 'Viraj Dhameja', result: '5.50', competition: 'Cubing Clash 1.0' },
    { rank: 4, name: 'Kunal Oak', result: '5.71', competition: 'Cubing Clash 2.0' },
    { rank: 5, name: 'Sundararajan V', result: '5.88', competition: 'Frosted Fingers 2025' },
  ];

  const displayRankings = rankings.length > 0 ? rankings : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Rankings</h1>
              <p className="text-gray-600">Explore PR leaderboards, players, competitions, and head-to-head matches.</p>
            </div>
            <div className="flex gap-4">
              <div className="bg-white rounded-xl px-6 py-3 shadow-sm">
                <div className="text-2xl font-bold text-gray-900">{stats.competitors}</div>
                <div className="text-sm text-gray-500">Competitors</div>
              </div>
              <div className="bg-white rounded-xl px-6 py-3 shadow-sm">
                <div className="text-2xl font-bold text-gray-900">{stats.solves}</div>
                <div className="text-sm text-gray-500">Solves</div>
              </div>
              <div className="bg-white rounded-xl px-6 py-3 shadow-sm">
                <div className="text-2xl font-bold text-gray-900">{stats.pastComps}</div>
                <div className="text-sm text-gray-500">Past Comps</div>
              </div>
              <div className="bg-white rounded-xl px-6 py-3 shadow-sm">
                <div className="text-2xl font-bold text-gray-900">{stats.events}</div>
                <div className="text-sm text-gray-500">Events</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['Rankings', 'Persons', 'Competitions', 'H2H'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t.toLowerCase())}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                tab === t.toLowerCase()
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Event Selection */}
        <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Event</label>
            <div className="flex flex-wrap gap-2">
              {events.map(event => (
                <button
                  key={event}
                  onClick={() => setSelectedEvent(event)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedEvent === event
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {event}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Mode</label>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setMode('single')}
                  className={`px-6 py-2 rounded-md font-medium transition-all ${
                    mode === 'single' ? 'bg-blue-600 text-white' : 'text-gray-600'
                  }`}
                >
                  Single
                </button>
                <button
                  onClick={() => setMode('ao5')}
                  className={`px-6 py-2 rounded-md font-medium transition-all ${
                    mode === 'ao5' ? 'bg-blue-600 text-white' : 'text-gray-600'
                  }`}
                >
                  Ao5
                </button>
              </div>
            </div>

            <div className="flex-1 max-w-md">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Rankings Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">
              {selectedEvent} • {mode === 'single' ? 'Single' : 'Ao5'}
              <span className="text-gray-400 font-normal ml-2">{displayRankings.length} players</span>
            </h2>
          </div>
          
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading rankings...</div>
          ) : displayRankings.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl mb-4">🏆</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No rankings yet</h3>
              <p className="text-gray-500">Be the first to compete and set a record!</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-6 py-4 text-sm font-semibold text-gray-600">#</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-600">Player</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-600">Result</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-600">Competition</th>
                </tr>
              </thead>
              <tbody>
                {displayRankings.map((rank, index) => (
                  <tr key={rank.id || index} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold text-gray-900">{index + 1}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{rank.userName || 'Unknown'}</td>
                    <td className="px-6 py-4 font-bold text-blue-600">
                      {mode === 'single' ? formatTime(rank.bestSingle) : formatTime(rank.average)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{rank.competitionName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default RankingsPage;
