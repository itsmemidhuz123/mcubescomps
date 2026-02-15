'use client'

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, collection, addDoc, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Eye, AlertTriangle, Check, Play, Square, Mail, Video } from 'lucide-react';
import { getEventName, getEventIcon } from '@/lib/wcaEvents';

function TimerPage() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [competition, setCompetition] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [phase, setPhase] = useState('intro'); // intro, rules, ready, inspection, solving, submitted, complete, evidence
  const [inspectionTime, setInspectionTime] = useState(15000); // Store in ms for accuracy
  const [solveTime, setSolveTime] = useState(0);
  const [scrambleRevealed, setScrambleRevealed] = useState(false);
  const [currentScramble, setCurrentScramble] = useState('');
  const [penalty, setPenalty] = useState('none');
  const [existingSolves, setExistingSolves] = useState([]);
  const [saving, setSaving] = useState(false);
  const [scrambleRevealedId, setScrambleRevealedId] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Anti-cheat state
  const [flagged, setFlagged] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  
  const inspectionStartRef = useRef(null);
  const solveStartRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const beepPlayedRef = useRef({ eight: false, five: false });

  // Anti-cheat Listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && (phase === 'inspection' || phase === 'solving')) {
        setFlagged(true);
        setFlagReason(prev => {
          if (prev.includes('Tab switch')) return prev;
          return prev ? `${prev}, Tab switch detected` : 'Tab switch detected';
        });
      }
    };

    const handleBlur = () => {
      if (phase === 'inspection' || phase === 'solving') {
        setFlagged(true);
        setFlagReason(prev => {
          if (prev.includes('Focus lost')) return prev;
          return prev ? `${prev}, Focus lost` : 'Focus lost';
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [phase]);

  // Initialize and fetch data
  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    initializeCompetition();
  }, [user, params.competitionId, params.eventId]);

  async function initializeCompetition() {
    setLoading(true);
    try {
      // Fetch competition
      const compDoc = await getDoc(doc(db, 'competitions', params.competitionId));
      if (!compDoc.exists()) {
        alert('Competition not found!');
        router.push('/competitions');
        return;
      }

      const compData = { id: compDoc.id, ...compDoc.data() };
      
      // Security Check: Suspension
      if (userProfile?.status === 'SUSPENDED') {
        alert('Your account is suspended. You cannot compete.');
        router.push('/');
        return;
      }

      // Check competition timing
      const now = new Date();
      const compStart = compData.competitionStartDate ? new Date(compData.competitionStartDate) :
                        (compData.startDate ? new Date(compData.startDate) : null);
      const compEnd = compData.competitionEndDate ? new Date(compData.competitionEndDate) :
                      (compData.endDate ? new Date(compData.endDate) : null);
      
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
      
      setCompetition(compData);

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
      
      if (!regData.events?.includes(params.eventId)) {
        alert('You are not registered for this event!');
        router.push(`/competition/${params.competitionId}`);
        return;
      }

      // Fetch existing solves and check for DNF on refresh
      await loadSolvesAndCheckDNF(compData);
      
    } catch (error) {
      console.error('Failed to initialize:', error);
      alert('Failed to load competition data');
    } finally {
      setLoading(false);
    }
  }

  async function loadSolvesAndCheckDNF(compData) {
    // Fetch existing solves
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
    
    const solveLimit = compData?.solveLimit || 5;
    const nextAttempt = solves.length + 1;
    setCurrentAttempt(nextAttempt);

    // Check if all solves completed
    if (solves.length >= solveLimit) {
      setPhase('evidence');
      return;
    }

    // Check for revealed scramble (DNF on refresh)
    const revealKey = `${user.uid}_${params.competitionId}_${params.eventId}_${nextAttempt}`;
    try {
      const revealDoc = await getDoc(doc(db, 'scrambleReveals', revealKey));
      if (revealDoc.exists()) {
        const data = revealDoc.data();
        if (data.revealed && !data.submitted) {
          // Mark as DNF due to refresh
          await saveSolve(0, 'DNF', true);
          alert('Your previous attempt was marked as DNF because you refreshed after revealing the scramble.');
          // Reload solves
          await loadSolvesAndCheckDNF(compData);
          return;
        }
      }
    } catch (e) {
      console.error('Error checking reveal:', e);
    }

    // Load scramble
    const scrambles = compData?.scrambles?.[params.eventId];
    if (scrambles && scrambles.length >= nextAttempt) {
      setCurrentScramble(scrambles[nextAttempt - 1]);
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  function playBeep(frequency = 440, duration = 150) {
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
      gainNode.gain.value = 0.5;
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration / 1000);
    } catch (e) {
      console.log('Audio not available');
    }
  }

  async function handleRevealScramble() {
    if (!user) return;
    
    try {
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
      setScrambleRevealed(true);
    }
  }

  function startInspection() {
    if (!scrambleRevealed) {
      alert('Please reveal the scramble first');
      return;
    }

    setPhase('inspection');
    setInspectionTime(15000);
    setPenalty('none');
    beepPlayedRef.current = { eight: false, five: false };
    inspectionStartRef.current = performance.now();

    // Use requestAnimationFrame for smooth updates
    function updateInspection() {
      const elapsed = performance.now() - inspectionStartRef.current;
      const remaining = 15000 - elapsed;
      
      setInspectionTime(remaining);

      // Beeps
      if (remaining <= 8000 && remaining > 7900 && !beepPlayedRef.current.eight) {
        playBeep(440);
        beepPlayedRef.current.eight = true;
      }
      if (remaining <= 5000 && remaining > 4900 && !beepPlayedRef.current.five) {
        playBeep(880);
        beepPlayedRef.current.five = true;
      }

      // Penalty zones
      if (remaining <= 0 && remaining > -2000) {
        setPenalty('+2');
      } else if (remaining <= -2000) {
        // Auto DNF
        setPenalty('DNF');
        cancelAnimationFrame(animationFrameRef.current);
        saveSolve(0, 'DNF');
        return;
      }

      animationFrameRef.current = requestAnimationFrame(updateInspection);
    }

    animationFrameRef.current = requestAnimationFrame(updateInspection);
  }

  function startSolve() {
    if (phase !== 'inspection') return;
    
    cancelAnimationFrame(animationFrameRef.current);
    setPhase('solving');
    setSolveTime(0);
    solveStartRef.current = performance.now();

    function updateSolve() {
      const elapsed = performance.now() - solveStartRef.current;
      setSolveTime(elapsed);
      animationFrameRef.current = requestAnimationFrame(updateSolve);
    }

    animationFrameRef.current = requestAnimationFrame(updateSolve);
  }

  function stopSolve() {
    if (phase !== 'solving') return;
    
    cancelAnimationFrame(animationFrameRef.current);
    const finalTime = performance.now() - solveStartRef.current;
    setSolveTime(finalTime);
    saveSolve(finalTime, penalty);
  }

  async function saveSolve(time, appliedPenalty, isRefreshDNF = false) {
    setSaving(true);
    setPhase('submitted');
    
    try {
      let finalTime = Math.round(time);
      if (appliedPenalty === '+2') {
        finalTime = Math.round(time) + 2000;
      } else if (appliedPenalty === 'DNF') {
        finalTime = Infinity;
      }

      // Save solve to Firestore with Anti-cheat flags
      await addDoc(collection(db, 'solves'), {
        userId: user.uid,
        userEmail: user.email,
        userName: userProfile?.displayName || 'Unknown',
        wcaStyleId: userProfile?.wcaStyleId || 'N/A',
        competitionId: params.competitionId,
        eventId: params.eventId,
        attemptNumber: currentAttempt,
        time: Math.round(time),
        finalTime: finalTime,
        penalty: appliedPenalty,
        scramble: currentScramble,
        isRefreshDNF: isRefreshDNF,
        flagged: flagged || isRefreshDNF, // Auto flag refresh DNFs
        flagReason: isRefreshDNF ? 'Page refreshed during solve' : flagReason,
        createdAt: new Date().toISOString()
      });

      // Mark scramble as submitted
      if (scrambleRevealedId) {
        await setDoc(doc(db, 'scrambleReveals', scrambleRevealedId), {
          submitted: true,
          submittedAt: new Date().toISOString()
        }, { merge: true });
      }

      // Check if all solves completed
      const solveLimit = competition?.solveLimit || 5;
      if (currentAttempt >= solveLimit) {
        await calculateAndSaveResults();
        setPhase('evidence');
      } else {
        // Prepare for next attempt after short delay
        setTimeout(() => {
          const nextAttempt = currentAttempt + 1;
          setCurrentAttempt(nextAttempt);
          setExistingSolves(prev => [...prev, { attemptNumber: currentAttempt, time, finalTime, penalty: appliedPenalty }]);
          setPhase('ready');
          setScrambleRevealed(false);
          setScrambleRevealedId(null);
          setSolveTime(0);
          setInspectionTime(15000);
          setPenalty('none');
          // Reset flags for next solve
          setFlagged(false);
          setFlagReason('');
          
          // Load next scramble
          const scrambles = competition?.scrambles?.[params.eventId];
          if (scrambles && scrambles.length >= nextAttempt) {
            setCurrentScramble(scrambles[nextAttempt - 1]);
          }
        }, 1500);
      }
    } catch (error) {
      console.error('Failed to save solve:', error);
      alert('Failed to save solve: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function calculateAndSaveResults() {
    try {
      const solvesQuery = query(
        collection(db, 'solves'),
        where('userId', '==', user.uid),
        where('competitionId', '==', params.competitionId),
        where('eventId', '==', params.eventId)
      );
      const solvesSnapshot = await getDocs(solvesQuery);
      const solves = solvesSnapshot.docs.map(doc => doc.data());
      
      const times = solves.map(s => s.finalTime || s.time);
      const validTimes = times.filter(t => t !== Infinity && typeof t === 'number');
      const bestSingle = validTimes.length > 0 ? Math.min(...validTimes) : Infinity;
      
      const dnfCount = times.filter(t => t === Infinity).length;
      let average = Infinity;
      
      if (times.length >= 5 && dnfCount <= 1) {
        const sorted = [...times].sort((a, b) => {
          if (a === Infinity) return 1;
          if (b === Infinity) return -1;
          return a - b;
        });
        const middle3 = sorted.slice(1, 4);
        if (!middle3.some(t => t === Infinity)) {
          average = Math.round(middle3.reduce((a, b) => a + b, 0) / 3);
        }
      }

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
      console.error('Failed to save results:', error);
    }
  }

  const formatTime = (ms) => {
    if (ms === Infinity || ms === null || ms === undefined) return 'DNF';
    const totalMs = Math.abs(Math.round(ms));
    const seconds = Math.floor(totalMs / 1000);
    const centiseconds = Math.floor((totalMs % 1000) / 10);
    return `${seconds}.${centiseconds.toString().padStart(2, '0')}`;
  };

  const formatInspection = (ms) => {
    const seconds = ms / 1000;
    if (seconds >= 0) {
      return Math.ceil(seconds).toString();
    } else {
      return `+${Math.abs(Math.ceil(seconds))}`;
    }
  };

  if (loading || !competition) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // INTRO SCREEN - How Competition Works
  if (phase === 'intro') {
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
                <div className="bg-blue-900/30 p-6 rounded-lg border border-blue-700">
                  <h2 className="text-xl font-semibold mb-4 text-blue-400">📋 How This Competition Works</h2>
                  <ul className="space-y-3 text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">1.</span>
                      You will complete <strong>{competition.solveLimit || 5} solves</strong> (Format: Ao{competition.solveLimit || 5})
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">2.</span>
                      Each solve has a <strong>hidden scramble</strong> that you must reveal
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">3.</span>
                      After revealing, you get <strong>15 seconds inspection</strong> time
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">4.</span>
                      Press the <strong>Start Solve</strong> button to begin timing
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">5.</span>
                      After all solves, you can submit <strong>video evidence</strong>
                    </li>
                  </ul>
                </div>

                <Button
                  onClick={() => setPhase('rules')}
                  className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg"
                >
                  Next: View Rules →
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // RULES SCREEN
  if (phase === 'rules') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Button
            variant="ghost"
            onClick={() => setPhase('intro')}
            className="mb-6 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="py-8">
              <div className="space-y-6">
                <div className="bg-yellow-900/30 p-6 rounded-lg border border-yellow-700">
                  <h2 className="text-xl font-semibold mb-4 text-yellow-400">⚠️ Important Rules</h2>
                  <ul className="space-y-3 text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="text-red-400">❌</span>
                      <strong>DO NOT REFRESH</strong> after revealing scramble - it will be marked as DNF!
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-400">⏱️</span>
                      <strong>15-second inspection</strong> - Audio beeps at 8s and 5s
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-400">+2</span>
                      Starting between <strong>15-17 seconds</strong> = +2 penalty
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400">DNF</span>
                      Starting after <strong>17 seconds</strong> = DNF
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400">✓</span>
                      Results are automatically calculated and saved
                    </li>
                  </ul>
                </div>

                <div className="bg-gray-900 p-6 rounded-lg">
                  <h2 className="text-xl font-semibold mb-4 text-gray-300">🎮 Controls</h2>
                  <ul className="space-y-2 text-gray-300">
                    <li><strong>Click buttons</strong> or use keyboard shortcuts</li>
                    <li><strong>SPACE</strong> → Start inspection (after revealing scramble)</li>
                    <li><strong>SPACE</strong> → Start solve (during inspection)</li>
                    <li><strong>SPACE</strong> → Stop timer (during solve)</li>
                  </ul>
                </div>

                <Button
                  onClick={() => setPhase('ready')}
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

  // EVIDENCE SUBMISSION SCREEN
  if (phase === 'evidence') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="py-8">
              <div className="text-center space-y-6">
                <div className="text-6xl">🎉</div>
                <h1 className="text-3xl font-bold">All Solves Complete!</h1>
                <p className="text-gray-400">
                  You have completed all {competition.solveLimit || 5} solves for {getEventName(params.eventId)}
                </p>
                
                <div className="bg-gray-900 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3">Your Solves:</h3>
                  <div className="flex flex-wrap justify-center gap-2">
                    {existingSolves.map((solve, i) => (
                      <Badge key={i} className={solve.penalty === 'DNF' || solve.finalTime === Infinity ? 'bg-red-600' : 'bg-blue-600'}>
                        {solve.penalty === 'DNF' || solve.finalTime === Infinity ? 'DNF' : formatTime(solve.finalTime || solve.time)}
                        {solve.penalty === '+2' && ' (+2)'}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Evidence Submission Section */}
                <div className="bg-purple-900/30 p-6 rounded-lg border border-purple-700 text-left">
                  <h2 className="text-xl font-semibold mb-4 text-purple-400 flex items-center gap-2">
                    <Video className="h-5 w-5" />
                    Submit Video Evidence
                  </h2>
                  <p className="text-gray-300 mb-4">
                    To validate your solves and be eligible for prizes, please submit video evidence of your solves.
                  </p>
                  <div className="space-y-3 text-gray-300">
                    <div className="flex items-start gap-2">
                      <span className="text-purple-400">1.</span>
                      Record all your solves showing the scramble and solve clearly
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-purple-400">2.</span>
                      Upload to <strong>Google Drive</strong> or <strong>YouTube (Unlisted)</strong>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-purple-400">3.</span>
                      Send the link via email to:
                    </div>
                    <div className="bg-gray-800 p-3 rounded flex items-center gap-2">
                      <Mail className="h-4 w-4 text-purple-400" />
                      <a href="mailto:hellobugsentertainment@gmail.com" className="text-purple-400 hover:underline font-mono">
                        hellobugsentertainment@gmail.com
                      </a>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-purple-400">4.</span>
                      Include your <strong>MCUBES ID: {userProfile?.wcaStyleId}</strong> in the email
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 justify-center pt-4">
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

  // MAIN TIMER SCREEN
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-800/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                if (scrambleRevealed && phase !== 'ready') {
                  if (!confirm('Your current solve will be marked as DNF if you leave. Are you sure?')) {
                    return;
                  }
                }
                router.push(`/competition/${params.competitionId}`);
              }}
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
                Solve {solve.attemptNumber}: {solve.penalty === 'DNF' || solve.finalTime === Infinity ? 'DNF' : formatTime(solve.finalTime || solve.time)}
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
                  disabled={phase !== 'ready'}
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

        {/* Timer Display */}
        <Card className="bg-gray-800 border-gray-700 w-full max-w-3xl">
          <CardContent className="py-12">
            <div className="text-center space-y-6">
              {/* READY STATE */}
              {phase === 'ready' && !scrambleRevealed && (
                <>
                  <div className="text-4xl font-bold text-gray-500">Reveal Scramble First</div>
                  <p className="text-gray-400">Click the button above to reveal the scramble</p>
                </>
              )}

              {phase === 'ready' && scrambleRevealed && (
                <>
                  <div className="text-6xl font-bold text-green-400">Ready</div>
                  <p className="text-gray-400">Click the button below or press SPACE to start inspection</p>
                  <Button
                    onClick={startInspection}
                    className="bg-green-600 hover:bg-green-700 py-6 px-12 text-xl"
                  >
                    <Play className="h-6 w-6 mr-2" />
                    Start Inspection
                  </Button>
                </>
              )}

              {/* INSPECTION STATE */}
              {phase === 'inspection' && (
                <>
                  <div className={`text-9xl font-bold tabular-nums ${
                    inspectionTime < 0 ? 'text-red-500 animate-pulse' :
                    inspectionTime < 5000 ? 'text-yellow-500' :
                    inspectionTime < 8000 ? 'text-orange-400' :
                    'text-blue-500'
                  }`}>
                    {formatInspection(inspectionTime)}
                  </div>
                  {penalty !== 'none' && (
                    <Badge className="text-2xl px-6 py-2 bg-red-600">
                      {penalty}
                    </Badge>
                  )}
                  <Button
                    onClick={startSolve}
                    className="bg-blue-600 hover:bg-blue-700 py-6 px-12 text-xl"
                  >
                    <Play className="h-6 w-6 mr-2" />
                    Start Solve
                  </Button>
                  <p className="text-gray-400 text-sm">Press SPACE or click button to start timing</p>
                </>
              )}

              {/* SOLVING STATE */}
              {phase === 'solving' && (
                <>
                  <div className="text-9xl font-bold text-green-500 tabular-nums">
                    {formatTime(solveTime)}
                  </div>
                  <Button
                    onClick={stopSolve}
                    className="bg-red-600 hover:bg-red-700 py-6 px-12 text-xl"
                  >
                    <Square className="h-6 w-6 mr-2" />
                    Stop Timer
                  </Button>
                  <p className="text-gray-400 text-sm">Press SPACE or click button to stop</p>
                </>
              )}

              {/* SUBMITTED STATE */}
              {phase === 'submitted' && (
                <>
                  <div className="text-8xl font-bold text-white tabular-nums">
                    {penalty === 'DNF' ? 'DNF' : formatTime(solveTime)}
                  </div>
                  {penalty === '+2' && (
                    <Badge className="text-xl px-4 py-1 bg-yellow-600">+2 Penalty</Badge>
                  )}
                  {penalty === 'DNF' && (
                    <Badge className="text-xl px-4 py-1 bg-red-600">DNF</Badge>
                  )}
                  <p className="text-green-400">
                    {saving ? '⏳ Saving...' : '✓ Saved! Next solve loading...'}
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default TimerPage;
