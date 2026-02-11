'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Timer, Trophy, Calendar, Users, LogOut } from 'lucide-react'

function AuthCallback({ onAuthComplete }) {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes('session_id=')) return;
    
    const sessionId = hash.split('session_id=')[1].split('&')[0];
    
    async function exchangeSession() {
      try {
        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId })
        });
        
        if (response.ok) {
          const userData = await response.json();
          // Clear hash and redirect
          window.history.replaceState(null, '', '/');
          onAuthComplete(userData);
        } else {
          console.error('Session exchange failed');
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Auth error:', error);
        window.location.href = '/';
      }
    }
    
    exchangeSession();
  }, [onAuthComplete]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
      <div className="text-white text-xl">Completing authentication...</div>
    </div>
  );
}

function LoginPage() {
  const handleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-800 border-gray-700">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Timer className="h-16 w-16 text-blue-500" />
          </div>
          <CardTitle className="text-3xl font-bold text-white">SpeedCube Online</CardTitle>
          <CardDescription className="text-gray-400 text-lg">
            Official-style online speedcubing competitions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-gray-300">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span>WCA-style competition format</span>
            </div>
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-blue-500" />
              <span>15-second inspection timer</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-500" />
              <span>Global leaderboards</span>
            </div>
          </div>
          <Button 
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 text-lg"
          >
            Login with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function CompetitionList({ user, onLogout }) {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
    fetchCompetitions();
  }, []);
  
  async function fetchCompetitions() {
    try {
      const response = await fetch('/api/competitions');
      const data = await response.json();
      setCompetitions(data);
    } catch (error) {
      console.error('Failed to fetch competitions:', error);
    } finally {
      setLoading(false);
    }
  }
  
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'upcoming': return 'bg-yellow-500';
      case 'running': return 'bg-green-500';
      case 'completed': return 'bg-gray-500';
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
              <Timer className="h-8 w-8 text-blue-500" />
              <h1 className="text-2xl font-bold">SpeedCube Online</h1>
            </div>
            <div className="flex items-center gap-4">
              {user.picture && (
                <img src={user.picture} alt={user.name} className="h-10 w-10 rounded-full" />
              )}
              <div className="text-right">
                <p className="font-semibold">{user.name}</p>
                {user.isAdmin && (
                  <Badge className="bg-purple-600 text-xs">Admin</Badge>
                )}
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={onLogout}
                className="border-gray-600 hover:bg-gray-700"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold">Competitions</h2>
          {user.isAdmin && (
            <Button 
              onClick={() => router.push('/admin/create')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Create Competition
            </Button>
          )}
        </div>
        
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading competitions...</div>
        ) : competitions.length === 0 ? (
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="py-12 text-center text-gray-400">
              No competitions yet. {user.isAdmin && 'Create your first competition!'}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {competitions.map(comp => (
              <Card 
                key={comp.id}
                className="bg-gray-800 border-gray-700 hover:border-blue-500 transition-colors cursor-pointer"
                onClick={() => router.push(`/competitions/${comp.slug}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-xl text-white">{comp.name}</CardTitle>
                    <Badge className={getStatusColor(comp.status)}>
                      {comp.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-400">
                    <div className="flex items-center gap-2 mt-2">
                      <Calendar className="h-4 w-4" />
                      {formatDate(comp.startDate)} - {formatDate(comp.endDate)}
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Users className="h-4 w-4" />
                    <span>{comp._count?.results || 0} participants</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  
  useEffect(() => {
    // Check if already authenticated
    checkAuth();
  }, []);
  
  async function checkAuth() {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  }
  
  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { credentials: 'include' });
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }
  
  // Check for auth callback
  if (typeof window !== 'undefined' && window.location.hash.includes('session_id=')) {
    return <AuthCallback onAuthComplete={(userData) => setUser(userData)} />;
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }
  
  if (!user) {
    return <LoginPage />;
  }
  
  return <CompetitionList user={user} onLogout={handleLogout} />;
}

export default App;
