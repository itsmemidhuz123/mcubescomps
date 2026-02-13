'use client'

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Eye, AlertTriangle } from 'lucide-react';
import { getEventName, getEventIcon } from '@/lib/wcaEvents';

function TimerPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [competition, setCompetition] = useState(null);
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [phase, setPhase] = useState('ready'); // ready, inspection, solving, submitting
  const [inspectionTime, setInspectionTime] = useState(15);
  const [solveTime, setSolveTime] = useState(0);
  const [scrambleRevealed, setScrambleRevealed] = useState(false);
  const [currentScramble, setCurrentScramble] = useState('');
  const [penalty, setPenalty] = useState('none');
  const [spacePressed, setSpacePressed] = useState(false);
  
  const inspectionTimerRef = useRef(null);
  const solveTimerRef = useRef(null);
  const solveStartTimeRef = useRef(null);
  const audioContextRef = useRef(null);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    fetchCompetition();
  }, [params, user]);

  useEffect(() => {
    // Keyboard controls
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (phase === 'ready') {
          setSpacePressed(true);
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (phase === 'ready' && spacePressed) {
          startInspection();
        } else if (phase === 'inspection') {
          startSolve();
        } else if (phase === 'solving') {
          stopSolve();
        }
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(inspectionTimerRef.current);
      clearInterval(solveTimerRef.current);
    };
  }, [phase, spacePressed]);

  // Prevent refresh during solve
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (scrambleRevealed && phase !== 'ready') {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [scrambleRevealed, phase]);

  async function fetchCompetition() {
    try {
      const compDoc = await getDoc(doc(db, 'competitions', params.competitionId));
      if (compDoc.exists()) {
        const data = compDoc.data();
        setCompetition({ id: compDoc.id, ...data });
        
        // Get scramble for this event
        const scrambles = data.scrambles[params.eventId];
        if (scrambles && scrambles.length >= currentAttempt) {
          setCurrentScramble(scrambles[currentAttempt - 1]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch competition:', error);
    }
  }

  function playBeep(frequency) {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  }

  function startInspection() {
    if (!scrambleRevealed) {
      alert('Please reveal the scramble first');
      return;
    }

    setPhase('inspection');
    setInspectionTime(15);
    setPenalty('none');

    inspectionTimerRef.current = setInterval(() => {
      setInspectionTime(prev => {
        const newTime = prev - 0.01;

        // Beeps
        if (Math.abs(newTime - 8) < 0.02) playBeep(440);
        if (Math.abs(newTime - 5) < 0.02) playBeep(440);

        // Penalties
        if (newTime <= 0 && newTime > -2) {
          if (penalty === 'none') {
            setPenalty('+2');
          }
        }

        if (newTime <= -2) {
          clearInterval(inspectionTimerRef.current);
          setPenalty('DNF');
          // Auto-submit DNF
          submitSolve(0, 'DNF');
          return newTime;
        }

        return newTime;
      });
    }, 10);
  }

  function startSolve() {
    if (phase !== 'inspection') return;

    clearInterval(inspectionTimerRef.current);
    setPhase('solving');
    setSolveTime(0);
    solveStartTimeRef.current = Date.now();

    solveTimerRef.current = setInterval(() => {
      setSolveTime(Date.now() - solveStartTimeRef.current);
    }, 10);
  }

  function stopSolve() {
    if (phase !== 'solving') return;

    clearInterval(solveTimerRef.current);
    const finalTime = Date.now() - solveStartTimeRef.current;
    setSolveTime(finalTime);
    setPhase('submitting');

    // Submit solve
    submitSolve(finalTime, penalty);
  }

  async function submitSolve(time, appliedPenalty) {
    try {
      const response = await fetch('/api/competition/submit-solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          competitionId: params.competitionId,
          eventId: params.eventId,
          attemptNumber: currentAttempt,
          time,
          penalty: appliedPenalty
        })
      });

      if (response.ok) {
        // Check if all solves completed
        if (currentAttempt >= (competition?.solveLimit || 5)) {
          // Calculate results
          await calculateResults();
          // Go to leaderboard
          setTimeout(() => {
            router.push(`/leaderboard/${params.competitionId}`);
          }, 2000);
        } else {
          // Next attempt
          setTimeout(() => {
            const nextAttempt = currentAttempt + 1;
            setCurrentAttempt(nextAttempt);
            setPhase('ready');
            setScrambleRevealed(false);
            setSolveTime(0);
            setPenalty('none');
            // Load next scramble
            const scrambles = competition.scrambles[params.eventId];
            if (scrambles && scrambles.length >= nextAttempt) {
              setCurrentScramble(scrambles[nextAttempt - 1]);
            }
          }, 1500);
        }
      }
    } catch (error) {
      console.error('Failed to submit solve:', error);
      alert('Failed to submit solve');
    }
  }

  async function calculateResults() {
    try {
      await fetch('/api/competition/calculate-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          competitionId: params.competitionId,
          eventId: params.eventId
        })
      });
    } catch (error) {
      console.error('Failed to calculate results:', error);
    }
  }

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${seconds}.${centiseconds.toString().padStart(2, '0')}`;
  };

  const formatInspection = (seconds) => {
    if (seconds < 0) {
      return `+${Math.abs(seconds).toFixed(2)}`;
    }
    return seconds.toFixed(2);
  };

  if (!competition) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-800/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => router.push(`/competition/${params.competitionId}`)}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Exit
            </Button>
            <div className="text-center">
              <h2 className="text-xl font-bold">{getEventIcon(params.eventId)} {getEventName(params.eventId)}</h2>
              <p className="text-sm text-gray-400">Attempt {currentAttempt} of {competition.solveLimit}</p>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].slice(0, competition.solveLimit).map(i => (
                <Badge key={i} className={i <= currentAttempt - 1 ? 'bg-green-600' : i === currentAttempt ? 'bg-blue-600' : 'bg-gray-600'}>
                  {i}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-4">
        {/* Scramble */}
        <Card className="bg-gray-800 border-gray-700 w-full max-w-3xl mb-8">
          <CardContent className="py-6">
            {!scrambleRevealed ? (
              <div className="text-center">
                <p className="text-gray-400 mb-4">Scramble is hidden</p>
                <Button
                  onClick={() => setScrambleRevealed(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Reveal Scramble
                </Button>
                <p className="text-sm text-gray-500 mt-4">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Once revealed, refreshing will mark this attempt as DNF
                </p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-2xl font-mono text-blue-400">{currentScramble}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timer */}
        <Card className="bg-gray-800 border-gray-700 w-full max-w-3xl">
          <CardContent className="py-12">
            <div className="text-center space-y-6">
              {phase === 'ready' && scrambleRevealed && (
                <>
                  <div className="text-6xl font-bold text-white">Ready</div>
                  <p className="text-gray-400">Hold SPACE to start inspection</p>
                  {spacePressed && <p className="text-green-400">Release to start...</p>}
                </>
              )}

              {phase === 'inspection' && (
                <>
                  <div className={`text-9xl font-bold ${
                    inspectionTime < 0 ? 'text-red-500' :
                    inspectionTime < 5 ? 'text-yellow-500' :
                    'text-blue-500'
                  }`}>
                    {formatInspection(inspectionTime)}
                  </div>
                  {penalty !== 'none' && (
                    <Badge className="text-2xl px-6 py-2" variant="destructive">
                      {penalty}
                    </Badge>
                  )}
                  <p className="text-gray-400">Press SPACE to start solve</p>
                </>
              )}

              {phase === 'solving' && (
                <>
                  <div className="text-9xl font-bold text-green-500">
                    {formatTime(solveTime)}
                  </div>
                  <p className="text-gray-400">Press SPACE to stop</p>
                </>
              )}

              {phase === 'submitting' && (
                <>
                  <div className="text-8xl font-bold text-white">
                    {formatTime(solveTime)}
                  </div>
                  {penalty !== 'none' && (
                    <Badge className="text-2xl px-6 py-2" variant="destructive">
                      {penalty}
                    </Badge>
                  )}
                  <p className="text-gray-400">Submitting...</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        {phase === 'ready' && !scrambleRevealed && (
          <div className="mt-8 text-center text-gray-400 max-w-2xl">
            <p className="mb-2"><strong>Instructions:</strong></p>
            <p>1. Reveal the scramble</p>
            <p>2. Hold SPACE to start 15-second inspection</p>
            <p>3. Press SPACE to start solving</p>
            <p>4. Press SPACE to stop timer</p>
            <p className="mt-4 text-sm text-yellow-500">⚠️ +2 penalty if you start solving after 15 seconds</p>
            <p className="text-sm text-red-500">⚠️ DNF if you start solving after 17 seconds</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TimerPage;
