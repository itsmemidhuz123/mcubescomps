'use client'

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, collection, addDoc, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Eye, AlertTriangle, Check, X } from 'lucide-react';
import { getEventName, getEventIcon } from '@/lib/wcaEvents';

function TimerPage() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [competition, setCompetition] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [phase, setPhase] = useState('intro'); // intro, ready, inspection, solving, submitted, complete
  const [inspectionTime, setInspectionTime] = useState(15);
  const [solveTime, setSolveTime] = useState(0);
  const [scrambleRevealed, setScrambleRevealed] = useState(false);
  const [currentScramble, setCurrentScramble] = useState('');
  const [penalty, setPenalty] = useState('none');
  const [spacePressed, setSpacePressed] = useState(false);
  const [existingSolves, setExistingSolves] = useState([]);
  const [saving, setSaving] = useState(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [scrambleRevealedId, setScrambleRevealedId] = useState(null); // Track revealed scramble in Firestore
  
  const inspectionTimerRef = useRef(null);
  const solveTimerRef = useRef(null);
  const solveStartTimeRef = useRef(null);
  const audioContextRef = useRef(null);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    fetchData();
  }, [params, user]);

  // Check for revealed scramble state (DNF on refresh)
  useEffect(() => {
    checkRevealedScramble();
  }, [user, params.competitionId, params.eventId, currentAttempt]);

  async function checkRevealedScramble() {
    if (!user) return;
    
    try {
      const revealKey = `${user.uid}_${params.competitionId}_${params.eventId}_${currentAttempt}`;
      const revealDoc = await getDoc(doc(db, 'scrambleReveals', revealKey));
      
      if (revealDoc.exists()) {
        const data = revealDoc.data();
        // If scramble was revealed but not submitted, and user refreshed, mark as DNF
        if (data.revealed && !data.submitted) {
          // Auto DNF
          await submitSolve(0, 'DNF', true);
          alert('Scramble was revealed but you refreshed the page. This attempt is marked as DNF.');
        }
      }
    } catch (error) {
      console.error('Error checking revealed scramble:', error);
    }
  }

  async function fetchData() {
    try {
      // Fetch competition
      const compDoc = await getDoc(doc(db, 'competitions', params.competitionId));
      if (compDoc.exists()) {
        const data = compDoc.data();
        
        // Check competition timing
        const now = new Date();
        const compStart = data.competitionStartDate ? new Date(data.competitionStartDate) :
                          (data.startDate ? new Date(data.startDate) : null);
        const compEnd = data.competitionEndDate ? new Date(data.competitionEndDate) :
                        (data.endDate ? new Date(data.endDate) : null);
        
        if (compStart && now < compStart) {
          alert('Competition has not started yet!');
          router.push(`/competition/${params.competitionId}`);
          return;
        }
        
        if (compEnd && now > compEnd) {
          alert('Competition has ended!');
          router.push(`/competition/${params.competitionId}`);
          return;
        }
        
        setCompetition({ id: compDoc.id, ...data });
      }

      // Check registration
      const regsQuery = query(
        collection(db, 'registrations'),
        where('userId', '==', user.uid),
        where('competitionId', '==', params.competitionId)
      );
      const regSnapshot = await getDocs(regsQuery);
      
      if (regSnapshot.empty) {
        alert('You are not registered for this competition!');
        router.push(`/competition/${params.competitionId}`);
        return;
      }
      
      const regData = regSnapshot.docs[0].data();
      setRegistration({ id: regSnapshot.docs[0].id, ...regData });
      
      // Check if user registered for this event
      if (!regData.events?.includes(params.eventId)) {
        alert('You are not registered for this event!');
        router.push(`/competition/${params.competitionId}`);
        return;
      }

      // Fetch existing solves
      await fetchExistingSolves();
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  }

  async function fetchExistingSolves() {
    try {
      const solvesQuery = query(
        collection(db, 'solves'),
        where('userId', '==', user.uid),
        where('competitionId', '==', params.competitionId),
        where('eventId', '==', params.eventId)
      );
      const solvesSnapshot = await getDocs(solvesQuery);
      const solves = solvesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      solves.sort((a, b) => a.attemptNumber - b.attemptNumber);
      setExistingSolves(solves);
      
      // Set current attempt number
      const nextAttempt = solves.length + 1;
      setCurrentAttempt(nextAttempt);
      
      // Check if all solves completed
      const solveLimit = competition?.solveLimit || 5;
      if (solves.length >= solveLimit) {
        setPhase('complete');
      }
    } catch (error) {
      console.error('Failed to fetch existing solves:', error);
    }
  }

  // Update scramble when competition or attempt changes
  useEffect(() => {
    if (competition && currentAttempt) {
      const scrambles = competition.scrambles?.[params.eventId];
      if (scrambles && scrambles.length >= currentAttempt) {
        setCurrentScramble(scrambles[currentAttempt - 1]);
      }
    }
  }, [competition, currentAttempt, params.eventId]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && phase !== 'intro' && phase !== 'submitted' && phase !== 'complete') {
        e.preventDefault();
        if (phase === 'ready' && scrambleRevealed) {
          setSpacePressed(true);
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (phase === 'ready' && spacePressed && scrambleRevealed) {
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
  }, [phase, spacePressed, scrambleRevealed]);

  // Prevent refresh during active solve
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (scrambleRevealed && phase !== 'ready' && phase !== 'submitted' && phase !== 'complete' && phase !== 'intro') {
        e.preventDefault();
        e.returnValue = 'Your solve will be marked as DNF if you leave!';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [scrambleRevealed, phase]);

  function playBeep(frequency, duration = 100) {
    try {
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
      oscillator.stop(ctx.currentTime + duration / 1000);
    } catch (e) {
      console.log('Audio not available');
    }
  }

  function handleAcceptRules() {
    setRulesAccepted(true);
    setPhase('ready');
  }

  async function handleRevealScramble() {
    if (!user) return;
    
    try {
      // Save reveal state to Firestore
      const revealKey = `${user.uid}_${params.competitionId}_${params.eventId}_${currentAttempt}`;
      await setDoc(doc(db, 'scrambleReveals', revealKey), {
        revealed: true,
        submitted: false,
        userId: user.uid,
        competitionId: params.competitionId,
        eventId: params.eventId,
        attemptNumber: currentAttempt,
        revealedAt: new Date().toISOString()
      });
      
      setScrambleRevealed(true);
      setScrambleRevealedId(revealKey);
    } catch (error) {
      console.error('Failed to save reveal state:', error);
      // Still reveal locally
      setScrambleRevealed(true);
    }
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

        // Beeps at 8 and 5 seconds
        if (Math.abs(newTime - 8) < 0.02) playBeep(440);
        if (Math.abs(newTime - 5) < 0.02) playBeep(440);

        // +2 penalty zone (15-17 seconds)
        if (newTime <= 0 && newTime > -2) {
          setPenalty('+2');
        }

        // DNF zone (>17 seconds)
        if (newTime <= -2) {
          clearInterval(inspectionTimerRef.current);
          setPenalty('DNF');
          submitSolve(0, 'DNF');
          return -2;
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
    submitSolve(finalTime, penalty);
  }

  async function submitSolve(time, appliedPenalty, isRefreshDNF = false) {
    setSaving(true);
    setPhase('submitted');
    
    try {
      // Calculate final time with penalty
      let finalTime = time;
      if (appliedPenalty === '+2') {
        finalTime = time + 2000;
      } else if (appliedPenalty === 'DNF') {
        finalTime = Infinity;
      }

      // Save solve to Firestore
      await addDoc(collection(db, 'solves'), {
        userId: user.uid,
        userEmail: user.email,
        userName: userProfile?.displayName || 'Unknown',
        wcaStyleId: userProfile?.wcaStyleId || 'N/A',
        competitionId: params.competitionId,
        eventId: params.eventId,
        attemptNumber: currentAttempt,
        time: time,
        finalTime: finalTime,
        penalty: appliedPenalty,
        scramble: currentScramble,
        isRefreshDNF: isRefreshDNF,
        createdAt: new Date().toISOString()
      });

      // Mark scramble as submitted
      if (scrambleRevealedId) {
        await setDoc(doc(db, 'scrambleReveals', scrambleRevealedId), {
          submitted: true,
          submittedAt: new Date().toISOString()
        }, { merge: true });
      }

      // Refresh solves list
      await fetchExistingSolves();

      // Check if all solves completed
      const solveLimit = competition?.solveLimit || 5;
      if (currentAttempt >= solveLimit) {
        // Calculate and save results
        await calculateAndSaveResults();
        setPhase('complete');
      } else {
        // Prepare for next attempt
        setTimeout(() => {
          const nextAttempt = currentAttempt + 1;
          setCurrentAttempt(nextAttempt);
          setPhase('ready');
          setScrambleRevealed(false);
          setScrambleRevealedId(null);
          setSolveTime(0);
          setInspectionTime(15);
          setPenalty('none');
        }, 1500);
      }
    } catch (error) {
      console.error('Failed to submit solve:', error);
      alert('Failed to save solve: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function calculateAndSaveResults() {
    try {
      // Get all solves for this event
      const solvesQuery = query(
        collection(db, 'solves'),
        where('userId', '==', user.uid),
        where('competitionId', '==', params.competitionId),
        where('eventId', '==', params.eventId)
      );
      const solvesSnapshot = await getDocs(solvesQuery);
      const solves = solvesSnapshot.docs.map(doc => doc.data());
      
      // Get times
      const times = solves.map(s => s.finalTime || s.time);
      
      // Calculate best single
      const validTimes = times.filter(t => t !== Infinity);
      const bestSingle = validTimes.length > 0 ? Math.min(...validTimes) : Infinity;
      
      // Calculate average (Ao5: remove best and worst)
      const dnfCount = times.filter(t => t === Infinity).length;
      let average = Infinity;
      
      if (times.length >= 5 && dnfCount <= 1) {
        const sorted = [...times].sort((a, b) => a - b);
        const middle3 = sorted.slice(1, 4);
        if (!middle3.some(t => t === Infinity)) {
          average = Math.round(middle3.reduce((a, b) => a + b, 0) / 3);
        }
      }

      // Save result
      await addDoc(collection(db, 'results'), {
        userId: user.uid,
        userEmail: user.email,
        userName: userProfile?.displayName || 'Unknown',
        wcaStyleId: userProfile?.wcaStyleId || 'N/A',
        country: userProfile?.country || 'Unknown',
        competitionId: params.competitionId,
        competitionName: competition?.name || '',
        eventId: params.eventId,
        times: times,
        bestSingle: bestSingle,
        average: average,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to calculate results:', error);
    }
  }

  const formatTime = (ms) => {
    if (ms === Infinity) return 'DNF';
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

  // Introduction Screen
  if (phase === 'intro' && !rulesAccepted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Button
            variant="ghost"
            onClick={() => router.push(`/competition/${params.competitionId}`)}
            className="mb-6 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="py-8">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">{getEventIcon(params.eventId)} {getEventName(params.eventId)}</h1>
                <p className="text-gray-400">{competition.name}</p>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-900 p-6 rounded-lg">
                  <h2 className="text-xl font-semibold mb-4 text-yellow-400">⚠️ Competition Rules</h2>
                  <ul className="space-y-3 text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="text-green-400">•</span>
                      You have {competition.solveLimit || 5} attempts (Format: Ao{competition.solveLimit || 5})
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400">•</span>
                      Scramble must be revealed before starting inspection
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400">•</span>
                      <strong>Refreshing after revealing scramble = DNF</strong>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-400">•</span>
                      15-second inspection time (WCA rules apply)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-400">•</span>
                      15-17 seconds = +2 penalty
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400">•</span>
                      Greater than 17 seconds = DNF
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400">•</span>
                      Beeps at 8 seconds and 5 seconds
                    </li>
                  </ul>
                </div>

                <div className="bg-gray-900 p-6 rounded-lg">
                  <h2 className="text-xl font-semibold mb-4 text-blue-400">🎮 Controls</h2>
                  <ul className="space-y-2 text-gray-300">
                    <li><strong>Hold SPACE</strong> → Start inspection</li>
                    <li><strong>Press SPACE</strong> → Start timer (during inspection)</li>
                    <li><strong>Press SPACE</strong> → Stop timer (during solve)</li>
                  </ul>
                </div>

                <Button
                  onClick={handleAcceptRules}
                  className="w-full bg-green-600 hover:bg-green-700 py-6 text-lg"
                >
                  <Check className="h-5 w-5 mr-2" />
                  I Understand, Start Competition
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Complete Screen
  if (phase === 'complete') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="py-8">
              <div className="text-center space-y-6">
                <div className="text-6xl">🎉</div>
                <h1 className="text-3xl font-bold">Event Complete!</h1>
                <p className="text-gray-400">You have completed all {competition.solveLimit || 5} solves for {getEventName(params.eventId)}</p>
                
                <div className="bg-gray-900 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3">Your Solves:</h3>
                  <div className="flex flex-wrap justify-center gap-2">
                    {existingSolves.map((solve, i) => (
                      <Badge key={i} className={solve.penalty === 'DNF' ? 'bg-red-600' : 'bg-blue-600'}>
                        {solve.penalty === 'DNF' ? 'DNF' : formatTime(solve.finalTime || solve.time)}
                        {solve.penalty === '+2' && ' (+2)'}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 justify-center">
                  <Button
                    onClick={() => router.push(`/leaderboard/${params.competitionId}`)}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    View Leaderboard
                  </Button>
                  <Button
                    onClick={() => router.push(`/competition/${params.competitionId}`)}
                    variant="outline"
                    className="border-gray-600"
                  >
                    Back to Competition
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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
              <p className="text-sm text-gray-400">Attempt {currentAttempt} of {competition.solveLimit || 5}</p>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: competition.solveLimit || 5 }, (_, i) => i + 1).map(i => (
                <Badge key={i} className={
                  existingSolves.find(s => s.attemptNumber === i) ? 'bg-green-600' :
                  i === currentAttempt ? 'bg-blue-600' : 'bg-gray-600'
                }>
                  {i}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Previous Solves */}
      {existingSolves.length > 0 && (
        <div className="container mx-auto px-4 py-2">
          <div className="flex flex-wrap gap-2 justify-center">
            {existingSolves.map((solve, i) => (
              <Badge key={i} variant="outline" className="border-gray-600">
                Solve {solve.attemptNumber}: {solve.penalty === 'DNF' ? 'DNF' : formatTime(solve.finalTime || solve.time)}
                {solve.penalty === '+2' && ' (+2)'}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)] p-4">
        {/* Scramble */}
        <Card className="bg-gray-800 border-gray-700 w-full max-w-3xl mb-8">
          <CardContent className="py-6">
            {!scrambleRevealed ? (
              <div className="text-center">
                <p className="text-gray-400 mb-4">Scramble is hidden</p>
                <Button
                  onClick={handleRevealScramble}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Reveal Scramble
                </Button>
                <p className="text-sm text-red-400 mt-4">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Once revealed, refreshing will mark this attempt as DNF!
                </p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-2xl font-mono text-blue-400 break-words">{currentScramble}</p>
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
                  {spacePressed && <p className="text-green-400 animate-pulse">Release to start...</p>}
                </>
              )}

              {phase === 'ready' && !scrambleRevealed && (
                <>
                  <div className="text-4xl font-bold text-gray-500">Reveal Scramble First</div>
                  <p className="text-gray-400">Click the button above to reveal the scramble</p>
                </>
              )}

              {phase === 'inspection' && (
                <>
                  <div className={`text-9xl font-bold ${
                    inspectionTime < 0 ? 'text-red-500 animate-pulse' :
                    inspectionTime < 5 ? 'text-yellow-500' :
                    inspectionTime < 8 ? 'text-orange-400' :
                    'text-blue-500'
                  }`}>
                    {formatInspection(inspectionTime)}
                  </div>
                  {penalty !== 'none' && (
                    <Badge className="text-2xl px-6 py-2 bg-red-600">
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

              {phase === 'submitted' && (
                <>
                  <div className="text-8xl font-bold text-white">
                    {penalty === 'DNF' ? 'DNF' : formatTime(solveTime)}
                  </div>
                  {penalty === '+2' && (
                    <Badge className="text-xl px-4 py-1 bg-yellow-600">+2 Penalty</Badge>
                  )}
                  {penalty === 'DNF' && (
                    <Badge className="text-xl px-4 py-1 bg-red-600">DNF</Badge>
                  )}
                  <p className="text-green-400">
                    {saving ? 'Saving...' : '✓ Saved! Next solve loading...'}
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Touch Controls for Mobile */}
        {scrambleRevealed && (phase === 'ready' || phase === 'inspection' || phase === 'solving') && (
          <div className="mt-8 w-full max-w-3xl">
            <Button
              className="w-full py-12 text-2xl bg-gray-700 hover:bg-gray-600"
              onTouchStart={() => {
                if (phase === 'ready') setSpacePressed(true);
              }}
              onTouchEnd={() => {
                if (phase === 'ready' && spacePressed) startInspection();
                else if (phase === 'inspection') startSolve();
                else if (phase === 'solving') stopSolve();
                setSpacePressed(false);
              }}
              onMouseDown={() => {
                if (phase === 'ready') setSpacePressed(true);
              }}
              onMouseUp={() => {
                if (phase === 'ready' && spacePressed) startInspection();
                else if (phase === 'inspection') startSolve();
                else if (phase === 'solving') stopSolve();
                setSpacePressed(false);
              }}
            >
              {phase === 'ready' ? 'HOLD TO START INSPECTION' :
               phase === 'inspection' ? 'TAP TO START SOLVE' :
               'TAP TO STOP'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TimerPage;
