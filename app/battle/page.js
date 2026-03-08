'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Loader2, Sword, ArrowLeft } from 'lucide-react';
import { useMatchmaking } from '../../hooks/useMatchmaking';

export default function BattlePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { status: matchmakingStatus, battleId: matchBattleId, error: matchmakingError, startMatchmaking, leaveQueue } = useMatchmaking(user);
  
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (matchmakingStatus === 'matched' && matchBattleId) {
      router.push(`/battle/${matchBattleId}`);
    }
  }, [matchmakingStatus, matchBattleId, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirect=/battle');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      leaveQueue();
    }
  }, [user, leaveQueue]);

  const handleQuickMatch = async () => {
    if (!user) {
      router.push('/auth/login?redirect=/battle');
      return;
    }
    
    setIsStarting(true);
    try {
      await startMatchmaking();
    } catch (error) {
      console.error('Quick match error:', error);
      alert('Failed to start quick match. Please try again.');
      setIsStarting(false);
    }
  };

  const isSearching = matchmakingStatus === 'searching' || matchmakingStatus === 'waiting';

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => router.push('/')}
          className="mb-4 text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sword className="w-6 h-6 text-blue-500" />
              Quick Battle
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isSearching || isStarting ? (
              <div className="text-center py-8">
                <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                <p className="text-lg mb-2">
                  {matchmakingStatus === 'searching' ? 'Finding opponent...' : 'Waiting for opponent...'}
                </p>
                <p className="text-sm text-zinc-400 mb-4">
                  3x3 • Ao5
                </p>
                <Button
                  onClick={() => {
                    leaveQueue();
                    setIsStarting(false);
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="mb-6">
                  <div className="text-4xl font-bold mb-2">3x3</div>
                  <div className="text-zinc-400">Ao5 Format</div>
                </div>
                
                <Button
                  onClick={handleQuickMatch}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-500 text-lg px-8"
                >
                  <Sword className="w-5 h-5 mr-2" />
                  Find Match
                </Button>

                {matchmakingError && (
                  <p className="text-red-400 mt-4 text-sm">{matchmakingError}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
