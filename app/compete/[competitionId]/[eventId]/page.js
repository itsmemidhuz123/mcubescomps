'use client'

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, collection, addDoc, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Eye, AlertTriangle, Check, Play, Square, Mail, Video, Clock, Timer, Shield, Layers } from 'lucide-react';
import { getEventName } from '@/lib/wcaEvents';
import EventIcon from '@/lib/EventIcon';
import { AntiCheatDetector, getDeviceFingerprint, getUserIP } from '@/lib/antiCheat';
import { CompetitionMode, TournamentStatus, getRoundStatus, canUserCompeteInRound } from '@/lib/tournament';
import { getCurrentRound, getNextRound, getUserPosition, isQualified } from '@/lib/competitionLogic';
import EventSelector from '@/components/competition/EventSelector';
import RoundStatus from '@/components/competition/RoundStatus';

// Helper to format time from milliseconds
function formatTimeDisplay(ms) {
    if (ms === null || ms === undefined) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function TimerPage() {
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const params = useParams();
    const [competition, setCompetition] = useState(null);
    const [eventConfig, setEventConfig] = useState(null);
    const [registration, setRegistration] = useState(null);
    const [tournamentParticipant, setTournamentParticipant] = useState(null);
    const [currentAttempt, setCurrentAttempt] = useState(1);
    const [phase, setPhase] = useState('intro');
    const [inspectionTime, setInspectionTime] = useState(15000);
    const [solveTime, setSolveTime] = useState(0);
    const [scrambleRevealed, setScrambleRevealed] = useState(false);
    const [currentScramble, setCurrentScramble] = useState('');
    const [penalty, setPenalty] = useState('none');
    const [existingSolves, setExistingSolves] = useState([]);
    const [saving, setSaving] = useState(false);
    const [scrambleRevealedId, setScrambleRevealedId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userIp, setUserIp] = useState(null);
    const [deviceInfo, setDeviceInfo] = useState(null);
    const [roundLocked, setRoundLocked] = useState(false);
    const [roundLockedReason, setRoundLockedReason] = useState('');

    // Video submission state
    const [videoUrl, setVideoUrl] = useState('');
    const [videoConfirmed, setVideoConfirmed] = useState(false);
    const [submittingVideo, setSubmittingVideo] = useState(false);
    const [videoSubmitted, setVideoSubmitted] = useState(false);
    const [submissionDeadline, setSubmissionDeadline] = useState(null);
    const [videoRequired, setVideoRequired] = useState(false);

    // Cut-off tracking state
    const [passedCutOff, setPassedCutOff] = useState(false);
    const [eliminatedByCutOff, setEliminatedByCutOff] = useState(false);

    // Multi-event state
    const [registeredEvents, setRegisteredEvents] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);

    // Anti-cheat state
    const antiCheatRef = useRef(null);
    const [antiCheatWarning, setAntiCheatWarning] = useState('');

    const inspectionStartRef = useRef(null);
    const solveStartRef = useRef(null);
    const animationFrameRef = useRef(null);
    const audioContextRef = useRef(null);
    const beepPlayedRef = useRef({ eight: false, five: false });

    // Initialize Anti-Cheat Detector
    useEffect(() => {
        antiCheatRef.current = new AntiCheatDetector();

        // Check for refresh violation on mount
        const hasRefreshViolation = antiCheatRef.current.checkForRefreshViolation();
        if (hasRefreshViolation) {
            setAntiCheatWarning('⚠️ Page refresh detected during previous solve');
        }

        return () => {
            if (antiCheatRef.current) {
                antiCheatRef.current.deactivate();
            }
        };
    }, []);

    // Initialize and fetch data
    useEffect(() => {
        if (!user) {
            router.push('/auth/login');
            return;
        }

        // Fetch IP and device info
        async function fetchSecurityInfo() {
            const ipData = await getUserIP();
            setUserIp(ipData);

            const deviceData = getDeviceFingerprint();
            setDeviceInfo(deviceData);
        }

        fetchSecurityInfo();
        initializeCompetition();
    }, [user, params.competitionId, params.eventId]);

    async function fetchLeaderboard(compData, eventId) {
        try {
            if (compData.mode !== CompetitionMode.TOURNAMENT) {
                return;
            }

            const currentRound = compData.currentRound || 1;
            const roundResultsQuery = query(
                collection(db, 'roundResults'),
                where('competitionId', '==', params.competitionId),
                where('eventId', '==', eventId),
                where('roundNumber', '==', currentRound)
            );
            const snapshot = await getDocs(roundResultsQuery);
            const results = snapshot.docs.map(doc => doc.data());
            setLeaderboard(results);
        } catch (error) {
            console.error('Failed to fetch leaderboard:', error);
        }
    }

    function handleEventSelect(eventId) {
        router.push(`/compete/${params.competitionId}/${eventId}`);
    }

    function handleProceedToNextRound() {
        const nextRound = getNextRound(competition, params.eventId);
        if (nextRound) {
            router.push(`/compete/${params.competitionId}/${params.eventId}`);
        }
    }

    function handleStartCompetition() {
        // Already on compete page, just continue
    }

    async function initializeCompetition() {
        setLoading(true);
        try {
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

            // Load event-specific configuration
            const config = compData.eventSettings?.[params.eventId] || {
                format: 'Ao5',
                applyCutOff: false,
                cutOffTime: 120000,
                cutOffAttempts: 2,
                applyMaxTime: false,
                maxTimeLimit: 600000
            };
            setEventConfig(config);

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

            // Set registered events for multi-event selector
            const events = regData.events || [];
            setRegisteredEvents(events);
            if (events.length > 0 && !params.eventId) {
                setSelectedEvent(events[0]);
            } else {
                setSelectedEvent(params.eventId);
            }

            if (!regData.events?.includes(params.eventId)) {
                alert('You are not registered for this event!');
                router.push(`/competition/${params.competitionId}`);
                return;
            }

            // Check verification requirement
            const currentRound = compData.currentRound || 1;
            const requiresVerification = compData.verificationMandatory &&
                currentRound >= (compData.verificationRequiredFromRound || 1);

            if (requiresVerification) {
                const userProfileQuery = query(collection(db, 'users'), where('uid', '==', user.uid));
                const userProfileSnapshot = await getDocs(userProfileQuery);
                const isVerified = !userProfileSnapshot.empty && userProfileSnapshot.docs[0].data().verificationStatus === 'VERIFIED';

                if (!isVerified) {
                    alert(`ID Verification Required\n\nYou must complete verification before starting Round ${currentRound}.\n\nContinue verification from your profile.`);
                    router.push(`/competition/${params.competitionId}`);
                    return;
                }
            }

            // Tournament mode checks
            if (compData.mode === CompetitionMode.TOURNAMENT) {
                const participantId = `${user.uid}_${params.competitionId}`;
                const participantDoc = await getDoc(doc(db, 'tournamentParticipants', participantId));

                if (!participantDoc.exists()) {
                    alert('Tournament participant record not found. Please re-register.');
                    router.push(`/competition/${params.competitionId}`);
                    return;
                }

                const participantData = participantDoc.data();
                setTournamentParticipant({ id: participantDoc.id, ...participantData });

                // Check if eliminated
                if (participantData.eliminated) {
                    setRoundLocked(true);
                    setRoundLockedReason('You have been eliminated from this tournament.');
                    setPhase('eliminated');
                    setLoading(false);
                    return;
                }

                // Check current round eligibility
                const currentRound = compData.currentRound || 1;
                const round = compData.rounds?.find(r => r.roundNumber === currentRound);

                if (participantData.currentRound < currentRound) {
                    setRoundLocked(true);
                    setRoundLockedReason(`You did not qualify for Round ${currentRound}.`);
                    setPhase('eliminated');
                    setLoading(false);
                    return;
                }

                // Check round status
                if (round) {
                    const roundStatus = getRoundStatus(round, compData);

                    if (roundStatus === 'waiting') {
                        setRoundLocked(true);
                        setRoundLockedReason(`Round ${currentRound} starts on ${round.scheduledDate ? new Date(round.scheduledDate).toLocaleString() : 'a scheduled date'}.`);
                        setLoading(false);
                        return;
                    }

                    if (roundStatus === 'completed') {
                        setRoundLocked(true);
                        setRoundLockedReason('This round has been completed.');
                        setPhase('eliminated');
                        setLoading(false);
                        return;
                    }

                    if (roundStatus === 'locked' || roundStatus === 'upcoming') {
                        setRoundLocked(true);
                        setRoundLockedReason(`Round ${currentRound} is not yet available.`);
                        setLoading(false);
                        return;
                    }
                }
            }

            await loadSolvesAndCheckDNF(compData, config);

            // Fetch leaderboard for round status
            await fetchLeaderboard(compData, params.eventId);

        } catch (error) {
            console.error('Failed to initialize:', error);
            alert('Failed to load competition data');
        } finally {
            setLoading(false);
        }
    }

    async function loadSolvesAndCheckDNF(compData, config) {
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

        // Check if already eliminated by cut-off
        const hasEliminationDNF = solves.some(s => s.reason === 'CUT_OFF_EXCEEDED');
        if (hasEliminationDNF) {
            setEliminatedByCutOff(true);
            setPhase('eliminated');
            return;
        }

        // Check cut-off status from existing solves
        if (config?.applyCutOff) {
            const cutOffAttempts = config.cutOffAttempts || 2;
            const attemptsForCutOff = solves.filter(s => s.attemptNumber <= cutOffAttempts);
            const hasPassed = attemptsForCutOff.some(s => {
                const time = s.finalTime != null ? s.finalTime : s.time;
                return time != null && time !== Infinity && time > 0 && time <= config.cutOffTime;
            });
            setPassedCutOff(hasPassed);

            // Check if failed cut-off (only if all cutoff attempts used and none passed)
            if (!hasPassed && attemptsForCutOff.length >= cutOffAttempts) {
                setEliminatedByCutOff(true);
                setPhase('eliminated');
                return;
            }
        } else {
            setPassedCutOff(true);
        }

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
                    await saveSolve(0, 'DNF', true, 'PAGE_REFRESH');
                    alert('Your previous attempt was marked as DNF because you refreshed after revealing the scramble.');
                    await loadSolvesAndCheckDNF(compData, config);
                    return;
                }
            }
        } catch (e) {
            console.error('Error checking reveal:', e);
        }

        // Load scramble
        const currentRound = compData.currentRound || 1;
        let scramblesData;

        // Tournament mode: scrambles are organized by round
        if (compData.mode === CompetitionMode.TOURNAMENT) {
            scramblesData = compData?.scrambles?.[params.eventId]?.[currentRound];
        } else {
            // Standard mode: flat scramble structure
            scramblesData = compData?.scrambles?.[params.eventId];
        }

        console.log('Scrambles data for', params.eventId, 'Round', currentRound, ':', scramblesData);

        if (scramblesData) {
            let scramblesArray = [];
            if (Array.isArray(scramblesData)) {
                scramblesArray = scramblesData;
            } else if (typeof scramblesData === 'object') {
                scramblesArray = Object.entries(scramblesData)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([, v]) => v);
            }
            console.log('Parsed scrambles array:', scramblesArray, 'Next attempt:', nextAttempt);
            if (scramblesArray.length >= nextAttempt && scramblesArray[nextAttempt - 1]) {
                setCurrentScramble(scramblesArray[nextAttempt - 1]);
            }
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

        // Activate anti-cheat system
        if (antiCheatRef.current) {
            antiCheatRef.current.reset();
            antiCheatRef.current.activate();
        }

        setPhase('inspection');
        setInspectionTime(15000);
        setPenalty('none');
        beepPlayedRef.current = { eight: false, five: false };
        inspectionStartRef.current = performance.now();

        function updateInspection() {
            const elapsed = performance.now() - inspectionStartRef.current;
            const remaining = 15000 - elapsed;

            setInspectionTime(remaining);

            if (remaining <= 8000 && remaining > 7900 && !beepPlayedRef.current.eight) {
                playBeep(440);
                beepPlayedRef.current.eight = true;
            }
            if (remaining <= 5000 && remaining > 4900 && !beepPlayedRef.current.five) {
                playBeep(880);
                beepPlayedRef.current.five = true;
            }

            if (remaining <= 0 && remaining > -2000) {
                setPenalty('+2');
            } else if (remaining <= -2000) {
                setPenalty('DNF');
                cancelAnimationFrame(animationFrameRef.current);
                saveSolve(0, 'DNF', false, 'INSPECTION_EXCEEDED');
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

            // Check maximum time limit during solve
            if (eventConfig?.applyMaxTime && elapsed > eventConfig.maxTimeLimit) {
                cancelAnimationFrame(animationFrameRef.current);
                setSolveTime(eventConfig.maxTimeLimit);
                saveSolve(eventConfig.maxTimeLimit, 'DNF', false, 'MAX_TIME_EXCEEDED');
                return;
            }

            animationFrameRef.current = requestAnimationFrame(updateSolve);
        }

        animationFrameRef.current = requestAnimationFrame(updateSolve);
    }

    function stopSolve() {
        if (phase !== 'solving') return;

        cancelAnimationFrame(animationFrameRef.current);
        const finalTime = performance.now() - solveStartRef.current;
        setSolveTime(finalTime);

        // Check if solve exceeds maximum time
        if (eventConfig?.applyMaxTime && finalTime > eventConfig.maxTimeLimit) {
            saveSolve(finalTime, 'DNF', false, 'MAX_TIME_EXCEEDED');
        } else {
            saveSolve(finalTime, penalty);
        }
    }

    async function saveSolve(time, appliedPenalty, isRefreshDNF = false, reason = null) {
        setSaving(true);
        setPhase('submitted');

        // Deactivate anti-cheat and get violation report
        let antiCheatReport = { flagged: false, violations: {}, flagReasons: [], anomalyScore: 0 };
        if (antiCheatRef.current) {
            antiCheatRef.current.deactivate();

            // Check for suspicious time
            const previousTimes = existingSolves.map(s => s.finalTime || s.time).filter(t => t && t !== Infinity);
            antiCheatRef.current.checkSuspiciousTime(time, previousTimes);

            antiCheatReport = antiCheatRef.current.getViolationReport();
        }

        try {
            let finalTime = Math.round(time);
            let solveReason = reason;

            // Apply +2 penalty before cut-off check
            if (appliedPenalty === '+2') {
                finalTime = Math.round(time) + 2000;
            } else if (appliedPenalty === 'DNF') {
                finalTime = Infinity;
            }

            // Determine if this solve passes cut-off
            let newPassedCutOff = passedCutOff;
            if (eventConfig?.applyCutOff && !passedCutOff && currentAttempt <= eventConfig.cutOffAttempts) {
                // Only non-DNF solves with valid finalTime can pass cut-off
                if (appliedPenalty !== 'DNF' && finalTime !== Infinity && finalTime != null && finalTime > 0 && finalTime <= eventConfig.cutOffTime) {
                    newPassedCutOff = true;
                    setPassedCutOff(true);
                }
            }

            const isFlagged = antiCheatReport.flagged || isRefreshDNF;
            const flagLevel = antiCheatReport.anomalyScore > 50 ? 'high' : antiCheatReport.anomalyScore > 20 ? 'medium' : antiCheatReport.anomalyScore > 0 ? 'low' : 'none';

            // Save solve to Firestore with anti-cheat data
            await addDoc(collection(db, 'solves'), {
                userId: user.uid,
                userEmail: user.email,
                userName: userProfile?.displayName || 'Unknown',
                wcaStyleId: userProfile?.wcaStyleId || 'N/A',
                userIp: userIp?.ip || 'unknown',
                ipCountry: userIp?.country || 'unknown',
                ipCity: userIp?.city || 'unknown',
                deviceInfo: deviceInfo || {},
                competitionId: params.competitionId,
                eventId: params.eventId,
                attemptNumber: currentAttempt,
                time: appliedPenalty === 'DNF' ? null : Math.round(time),
                finalTime: finalTime === Infinity ? null : finalTime,
                penalty: appliedPenalty,
                reason: solveReason,
                scramble: currentScramble,
                isRefreshDNF: isRefreshDNF,
                // Anti-cheat fields - Updated schema
                flagged: isFlagged,
                autoFlag: antiCheatReport.flagged,
                manualFlag: null,
                flagLevel: flagLevel,
                flagReason: antiCheatReport.flagReasons.join(', ') || (isRefreshDNF ? 'PAGE_REFRESH' : ''),
                suspicionScore: antiCheatReport.anomalyScore || 0,
                focusLossCount: antiCheatReport.violations.windowBlur ? 1 : 0,
                tabSwitchCount: antiCheatReport.violations.tabSwitch ? 1 : 0,
                visibilityViolation: antiCheatReport.violations.tabSwitch || false,
                windowBlurViolation: antiCheatReport.violations.windowBlur || false,
                multiTabViolation: antiCheatReport.violations.multiTab || false,
                rightClickViolation: antiCheatReport.violations.rightClick || false,
                devToolsViolation: antiCheatReport.violations.devTools || false,
                pageRefreshViolation: antiCheatReport.violations.pageRefresh || isRefreshDNF,
                suspiciousTimeViolation: antiCheatReport.violations.suspiciousTime || false,
                anomalyScore: antiCheatReport.anomalyScore || 0,
                // Admin fields
                adminVerified: false,
                adminNote: null,
                disqualified: false,
                createdAt: new Date().toISOString()
            });

            // Mark scramble as submitted
            if (scrambleRevealedId) {
                await setDoc(doc(db, 'scrambleReveals', scrambleRevealedId), {
                    submitted: true,
                    submittedAt: new Date().toISOString()
                }, { merge: true });
            }

            const solveLimit = competition?.solveLimit || 5;
            const updatedSolves = [...existingSolves, {
                attemptNumber: currentAttempt,
                time,
                finalTime: finalTime === Infinity ? null : finalTime,
                penalty: appliedPenalty,
                reason: solveReason,
                flagged: antiCheatReport.flagged || isRefreshDNF
            }];

            // Check if failed cut-off after this attempt
            if (eventConfig?.applyCutOff && !newPassedCutOff && currentAttempt >= eventConfig.cutOffAttempts) {
                const remainingAttempts = solveLimit - currentAttempt;
                for (let i = 1; i <= remainingAttempts; i++) {
                    await addDoc(collection(db, 'solves'), {
                        userId: user.uid,
                        userEmail: user.email,
                        userName: userProfile?.displayName || 'Unknown',
                        wcaStyleId: userProfile?.wcaStyleId || 'N/A',
                        userIp: userIp?.ip || 'unknown',
                        ipCountry: userIp?.country || 'unknown',
                        ipCity: userIp?.city || 'unknown',
                        deviceInfo: deviceInfo || {},
                        competitionId: params.competitionId,
                        eventId: params.eventId,
                        attemptNumber: currentAttempt + i,
                        time: null,
                        finalTime: null,
                        penalty: 'DNF',
                        reason: 'CUT_OFF_EXCEEDED',
                        scramble: getScrambleForAttempt(currentAttempt + i),
                        isRefreshDNF: false,
                        flagged: false,
                        flagReason: '',
                        visibilityViolation: false,
                        windowBlurViolation: false,
                        multiTabViolation: false,
                        rightClickViolation: false,
                        devToolsViolation: false,
                        pageRefreshViolation: false,
                        suspiciousTimeViolation: false,
                        anomalyScore: 0,
                        createdAt: new Date().toISOString()
                    });
                }

                setEliminatedByCutOff(true);
                await calculateAndSaveResults(true);
                setPhase('eliminated');
                return;
            }

            // Check if all solves completed
            if (currentAttempt >= solveLimit) {
                await calculateAndSaveResults(false);
                setPhase('evidence');
            } else {
                // Prepare for next attempt
                setTimeout(() => {
                    const nextAttempt = currentAttempt + 1;
                    setCurrentAttempt(nextAttempt);
                    setExistingSolves(updatedSolves);
                    setPhase('ready');
                    setScrambleRevealed(false);
                    setScrambleRevealedId(null);
                    setSolveTime(0);
                    setInspectionTime(15000);
                    setPenalty('none');
                    setAntiCheatWarning('');

                    const nextScramble = getScrambleForAttempt(nextAttempt);
                    if (nextScramble) {
                        setCurrentScramble(nextScramble);
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

    async function calculateAndSaveResults(eliminatedByCutOff = false) {
        try {
            const solvesQuery = query(
                collection(db, 'solves'),
                where('userId', '==', user.uid),
                where('competitionId', '==', params.competitionId),
                where('eventId', '==', params.eventId)
            );
            const solvesSnapshot = await getDocs(solvesQuery);
            const solves = solvesSnapshot.docs.map(doc => doc.data());

            const times = solves.map(s => {
                if (s.penalty === 'DNF' || s.finalTime === null || s.finalTime === undefined) {
                    return Infinity;
                }
                return s.finalTime;
            });

            const validTimes = times.filter(t => t !== Infinity && typeof t === 'number');
            const bestSingle = validTimes.length > 0 ? Math.min(...validTimes) : Infinity;

            const dnfCount = times.filter(t => t === Infinity).length;
            let average = Infinity;

            // WCA Average calculation
            if (times.length >= 5 && dnfCount <= 1 && !eliminatedByCutOff) {
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

            // Check if any solve was flagged
            const anyFlagged = solves.some(s => s.flagged);
            const totalAnomalyScore = solves.reduce((sum, s) => sum + (s.anomalyScore || 0), 0);
            const totalTabSwitches = solves.reduce((sum, s) => sum + (s.tabSwitchCount || 0), 0);
            const totalFocusLoss = solves.reduce((sum, s) => sum + (s.focusLossCount || 0), 0);
            const flagLevel = totalAnomalyScore > 50 ? 'high' : totalAnomalyScore > 20 ? 'medium' : totalAnomalyScore > 0 ? 'low' : 'none';

            const resultData = {
                userId: user.uid,
                userEmail: user.email,
                userName: userProfile?.displayName || 'Unknown',
                wcaStyleId: userProfile?.wcaStyleId || 'N/A',
                country: userProfile?.country || 'Unknown',
                competitionId: params.competitionId,
                competitionName: competition?.name || '',
                eventId: params.eventId,
                times: times.map(t => t === Infinity ? null : t),
                bestSingle: bestSingle === Infinity ? null : bestSingle,
                average: average === Infinity ? null : average,
                eliminatedByCutOff: eliminatedByCutOff,
                // Anti-cheat fields
                flagged: anyFlagged,
                autoFlag: anyFlagged,
                manualFlag: null,
                flagLevel: flagLevel,
                suspicionScore: totalAnomalyScore,
                focusLossCount: totalFocusLoss,
                tabSwitchCount: totalTabSwitches,
                totalAnomalyScore: totalAnomalyScore,
                // Admin fields
                adminVerified: false,
                adminNote: null,
                disqualified: false,
                qualifiedForNextRound: false,
                createdAt: new Date().toISOString()
            };

            // Save to standard results collection
            await addDoc(collection(db, 'results'), resultData);

            // For tournament mode, also save to roundResults
            if (competition?.mode === CompetitionMode.TOURNAMENT) {
                const currentRound = competition.currentRound || 1;
                const round = competition.rounds?.find(r => r.roundNumber === currentRound);
                const requireVerification = round?.requireVerification !== false;

                const roundResultData = {
                    ...resultData,
                    roundNumber: currentRound,
                    verified: false,
                    flagged: anyFlagged,
                    videoUrl: null
                };

                await addDoc(collection(db, 'roundResults'), roundResultData);
            }
        } catch (error) {
            console.error('Failed to save results:', error);
        }
    }

    // Check video requirement from competition settings
    useEffect(() => {
        if (competition) {
            const currentRound = competition.currentRound || 1;
            const videoRequiredFromRound = competition.videoRequiredFromRound || 1;
            const isVideoRequired = competition.videoRequired === true && currentRound >= videoRequiredFromRound;
            setVideoRequired(isVideoRequired);

            // Set 24 hour deadline
            const deadline = new Date();
            deadline.setHours(deadline.getHours() + 24);
            setSubmissionDeadline(deadline);
        }
    }, [competition]);

    // Submit video URL
    async function handleVideoSubmit() {
        if (!videoUrl.trim()) {
            alert('Please enter a video URL');
            return;
        }
        if (!videoConfirmed) {
            alert('Please confirm that your video contains all solves');
            return;
        }

        setSubmittingVideo(true);
        try {
            await addDoc(collection(db, 'videoSubmissions'), {
                userId: user.uid,
                userEmail: user.email,
                userName: userProfile?.displayName || 'Unknown',
                competitionId: params.competitionId,
                competitionName: competition?.name || '',
                eventId: params.eventId,
                roundNumber: competition?.currentRound || 1,
                videoUrl: videoUrl.trim(),
                videoSubmitted: true,
                videoSubmittedAt: new Date().toISOString(),
                videoSubmissionDeadline: submissionDeadline?.toISOString(),
                verificationStatus: 'pending',
                confirmationChecked: true,
                createdAt: new Date().toISOString()
            });

            setVideoSubmitted(true);
            alert('Video submitted successfully! Verification may take 1-2 days.');
        } catch (error) {
            console.error('Failed to submit video:', error);
            alert('Failed to submit video: ' + error.message);
        } finally {
            setSubmittingVideo(false);
        }
    }

    const formatTime = (ms) => {
        if (ms === Infinity || ms === null || ms === undefined) return 'DNF';
        const totalMs = Math.abs(Math.round(ms));
        const seconds = Math.floor(totalMs / 1000);
        const centiseconds = Math.floor((totalMs % 1000) / 10);
        return `${seconds}.${centiseconds.toString().padStart(2, '0')}`;
    };

    // Helper to get scramble for a specific attempt (supports tournament rounds)
    const getScrambleForAttempt = (attemptNumber) => {
        if (!competition || !params.eventId) return '';

        const currentRound = competition.currentRound || 1;
        let scramblesData;

        if (competition.mode === CompetitionMode.TOURNAMENT) {
            scramblesData = competition?.scrambles?.[params.eventId]?.[currentRound];
        } else {
            scramblesData = competition?.scrambles?.[params.eventId];
        }

        if (!scramblesData) return '';

        let scramblesArray = [];
        if (Array.isArray(scramblesData)) {
            scramblesArray = scramblesData;
        } else if (typeof scramblesData === 'object') {
            scramblesArray = Object.entries(scramblesData)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([, v]) => v);
        }

        return scramblesArray[attemptNumber - 1] || '';
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

    // INTRO SCREEN
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
                                <h1 className="text-3xl font-bold mb-2"><EventIcon eventId={params.eventId} size={28} /> {getEventName(params.eventId)}</h1>
                                <p className="text-gray-400">{competition.name}</p>
                                {competition.mode === CompetitionMode.TOURNAMENT && (
                                    <div className="mt-3 flex items-center justify-center gap-2">
                                        <Badge className="bg-indigo-600 text-white">
                                            <Layers className="h-3 w-3 mr-1" />
                                            Tournament - Round {competition.currentRound || 1}
                                        </Badge>
                                        {competition.rounds?.find(r => r.roundNumber === (competition.currentRound || 1))?.isFinal && (
                                            <Badge className="bg-yellow-600 text-white">Final Round</Badge>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-6">
                                <div className="bg-blue-900/30 p-6 rounded-lg border border-blue-700">
                                    <h2 className="text-xl font-semibold mb-4 text-blue-400">📋 How This Competition Works</h2>
                                    <ul className="space-y-3 text-gray-300">
                                        <li className="flex items-start gap-2">
                                            <span className="text-blue-400 font-bold">1.</span>
                                            You will complete <strong>{competition.solveLimit || 5} solves</strong> (Format: {eventConfig?.format || 'Ao5'})
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

                                {/* Event Time Limits Display */}
                                {(eventConfig?.applyCutOff || eventConfig?.applyMaxTime) && (
                                    <div className="bg-orange-900/30 p-6 rounded-lg border border-orange-700">
                                        <h2 className="text-xl font-semibold mb-4 text-orange-400 flex items-center gap-2">
                                            <Timer className="h-5 w-5" />
                                            Time Limits for This Event
                                        </h2>
                                        <div className="space-y-3 text-gray-300">
                                            {eventConfig?.applyCutOff && (
                                                <div className="flex items-start gap-2">
                                                    <Clock className="h-4 w-4 text-orange-400 mt-1" />
                                                    <div>
                                                        <strong className="text-orange-300">Cut-Off: {formatTimeDisplay(eventConfig.cutOffTime)}</strong>
                                                        <p className="text-sm text-gray-400">
                                                            You must beat this time within your first {eventConfig.cutOffAttempts} attempt(s), or remaining solves will be DNF.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                            {eventConfig?.applyMaxTime && (
                                                <div className="flex items-start gap-2">
                                                    <Timer className="h-4 w-4 text-red-400 mt-1" />
                                                    <div>
                                                        <strong className="text-red-300">Maximum Time: {formatTimeDisplay(eventConfig.maxTimeLimit)}</strong>
                                                        <p className="text-sm text-gray-400">
                                                            If any solve exceeds this time, it will be marked as DNF.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

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
                                        {eventConfig?.applyCutOff && (
                                            <li className="flex items-start gap-2">
                                                <span className="text-orange-400">✂️</span>
                                                <strong>Cut-Off:</strong> Beat {formatTimeDisplay(eventConfig.cutOffTime)} in first {eventConfig.cutOffAttempts} solve(s) or be eliminated
                                            </li>
                                        )}
                                        {eventConfig?.applyMaxTime && (
                                            <li className="flex items-start gap-2">
                                                <span className="text-red-400">⏰</span>
                                                <strong>Max Time:</strong> Any solve over {formatTimeDisplay(eventConfig.maxTimeLimit)} = DNF
                                            </li>
                                        )}
                                        <li className="flex items-start gap-2">
                                            <span className="text-green-400">✓</span>
                                            Results are automatically calculated and saved
                                        </li>
                                        {competition?.mode === CompetitionMode.TOURNAMENT && (
                                            <li className="flex items-start gap-2">
                                                <span className="text-indigo-400">🏆</span>
                                                <strong>Tournament:</strong> Your results will be verified by admin before round advancement
                                            </li>
                                        )}
                                    </ul>
                                </div>

                                {/* Competition Integrity Policy */}
                                <div className="bg-red-900/30 p-6 rounded-lg border border-red-700">
                                    <h2 className="text-xl font-semibold mb-4 text-red-400 flex items-center gap-2">
                                        <Shield className="h-5 w-5" />
                                        Competition Integrity Policy
                                    </h2>
                                    <p className="text-gray-300 mb-3">
                                        This competition uses an automated anti-cheat system to ensure fair play. The following actions during a solve will be detected and may result in your attempt being flagged for review:
                                    </p>
                                    <ul className="space-y-2 text-gray-300 text-sm">
                                        <li className="flex items-start gap-2">
                                            <span className="text-red-400">•</span>
                                            Switching tabs or minimizing the browser
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-red-400">•</span>
                                            Opening developer tools or browser inspect features
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-red-400">•</span>
                                            Refreshing the page after revealing the scramble
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-red-400">•</span>
                                            Opening multiple tabs of the competition
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-red-400">•</span>
                                            Suspicious timing patterns or impossibly fast solves
                                        </li>
                                    </ul>
                                    <p className="text-gray-400 text-sm mt-3">
                                        Flagged solves will be reviewed by administrators. Legitimate solves will not be affected.
                                    </p>
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

    // ELIMINATED BY CUT-OFF SCREEN
    if (phase === 'eliminated') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
                <div className="container mx-auto px-4 py-8 max-w-2xl">
                    <Card className="bg-gray-800 border-gray-700">
                        <CardContent className="py-8">
                            <div className="text-center space-y-6">
                                <div className="text-6xl">✂️</div>
                                <h1 className="text-3xl font-bold text-orange-400">Eliminated by Cut-Off</h1>
                                <p className="text-gray-400">
                                    You did not beat the cut-off time of <strong>{formatTimeDisplay(eventConfig?.cutOffTime)}</strong> within the first {eventConfig?.cutOffAttempts} attempt(s).
                                </p>

                                <div className="bg-orange-900/30 p-4 rounded-lg border border-orange-700">
                                    <p className="text-orange-300">
                                        All remaining solves have been marked as DNF. Your average for this event is DNF.
                                    </p>
                                </div>

                                <div className="bg-gray-900 p-4 rounded-lg">
                                    <h3 className="font-semibold mb-3">Your Attempts:</h3>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {existingSolves.map((solve, i) => (
                                            <Badge key={i} className={
                                                solve.penalty === 'DNF' || solve.finalTime === null
                                                    ? solve.reason === 'CUT_OFF_EXCEEDED'
                                                        ? 'bg-orange-600'
                                                        : 'bg-red-600'
                                                    : 'bg-blue-600'
                                            }>
                                                {solve.penalty === 'DNF' || solve.finalTime === null ? 'DNF' : formatTime(solve.finalTime)}
                                                {solve.penalty === '+2' && ' (+2)'}
                                                {solve.reason === 'CUT_OFF_EXCEEDED' && ' (Cut-Off)'}
                                                {solve.flagged && ' ⚠️'}
                                            </Badge>
                                        ))}
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

    // EVIDENCE SUBMISSION SCREEN
    if (phase === 'evidence') {
        const isDeadlinePassed = submissionDeadline && new Date() > submissionDeadline;

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
                                            <Badge key={i} className={
                                                solve.penalty === 'DNF' || solve.finalTime === null
                                                    ? solve.reason === 'MAX_TIME_EXCEEDED'
                                                        ? 'bg-purple-600'
                                                        : 'bg-red-600'
                                                    : 'bg-blue-600'
                                            }>
                                                {solve.penalty === 'DNF' || solve.finalTime === null ? 'DNF' : formatTime(solve.finalTime)}
                                                {solve.penalty === '+2' && ' (+2)'}
                                                {solve.reason === 'MAX_TIME_EXCEEDED' && ' (Max Time)'}
                                                {solve.flagged && ' ⚠️'}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                {/* Video Submission Section */}
                                {videoRequired && !videoSubmitted ? (
                                    <div className="bg-purple-900/30 p-6 rounded-lg border border-purple-700 text-left">
                                        <h2 className="text-xl font-semibold mb-4 text-purple-400 flex items-center gap-2">
                                            <Video className="h-5 w-5" />
                                            Submit Video Evidence
                                        </h2>

                                        {isDeadlinePassed ? (
                                            <div className="text-center py-4">
                                                <div className="text-red-400 text-lg mb-2">⏰ Video Submission Closed</div>
                                                <p className="text-gray-400 text-sm">
                                                    The 24-hour deadline has passed. Please contact admin for assistance.
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                {submissionDeadline && (
                                                    <div className="mb-4 p-3 bg-orange-900/30 border border-orange-600 rounded-lg">
                                                        <p className="text-orange-400 text-sm">
                                                            ⏱️ Submit within: {submissionDeadline.toLocaleString()}
                                                        </p>
                                                    </div>
                                                )}

                                                <p className="text-gray-300 mb-4">
                                                    To validate your solves and be eligible for prizes, please submit video evidence of your solves.
                                                </p>

                                                <div className="space-y-3 text-gray-300 mb-4">
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
                                                        Paste the link below
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-sm text-gray-400 mb-1">Video URL (YouTube or Google Drive)</label>
                                                        <Input
                                                            type="url"
                                                            placeholder="https://youtube.com/watch?v=... or https://drive.google.com/..."
                                                            value={videoUrl}
                                                            onChange={(e) => setVideoUrl(e.target.value)}
                                                            className="bg-gray-900 border-gray-600 text-white"
                                                        />
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <Checkbox
                                                            id="confirm"
                                                            checked={videoConfirmed}
                                                            onCheckedChange={(checked) => setVideoConfirmed(checked)}
                                                        />
                                                        <label htmlFor="confirm" className="text-sm text-gray-300">
                                                            I confirm this video contains all solves for this round
                                                        </label>
                                                    </div>

                                                    <Button
                                                        onClick={handleVideoSubmit}
                                                        disabled={submittingVideo || !videoUrl || !videoConfirmed}
                                                        className="w-full bg-purple-600 hover:bg-purple-700"
                                                    >
                                                        {submittingVideo ? 'Submitting...' : 'Submit Video'}
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ) : videoSubmitted ? (
                                    <div className="bg-green-900/30 p-6 rounded-lg border border-green-700 text-left">
                                        <div className="text-center">
                                            <div className="text-4xl mb-2">✅</div>
                                            <h2 className="text-xl font-semibold text-green-400 mb-2">Video Submitted!</h2>
                                            <p className="text-gray-300">
                                                Verification in progress. Check back in 1-2 days.
                                            </p>
                                        </div>
                                    </div>
                                ) : null}

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
                        
                        {/* Event Selector for Multi-Event Competitions */}
                        <div className="text-center">
                            {registeredEvents.length > 1 ? (
                                <EventSelector
                                    registeredEvents={registeredEvents}
                                    currentEvent={params.eventId}
                                    onSelect={handleEventSelect}
                                    competitionMode={competition?.mode}
                                    currentRound={competition?.currentRound}
                                />
                            ) : (
                                <>
                                    <h2 className="text-xl font-bold"><EventIcon eventId={params.eventId} size={24} /> {getEventName(params.eventId)}</h2>
                                    <p className="text-sm text-gray-400">Attempt {currentAttempt} of {competition?.solveLimit || 5}</p>
                                </>
                            )}
                        </div>
                        
                        <div className="flex gap-2">
                            {Array.from({ length: competition?.solveLimit || 5 }, (_, i) => i + 1).map(i => (
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

            {/* Round Status - Tournament Mode */}
            {competition?.mode === CompetitionMode.TOURNAMENT && (
                <div className="container mx-auto px-4 py-3">
                    <RoundStatus
                        competition={competition}
                        eventId={params.eventId}
                        userId={user?.uid}
                        leaderboard={leaderboard}
                        onProceedToNextRound={handleProceedToNextRound}
                        onStartCompetition={handleStartCompetition}
                    />
                </div>
            )}

            {/* Anti-cheat warning banner */}
            {antiCheatWarning && (
                <div className="bg-yellow-900/50 border-b border-yellow-700 py-2">
                    <div className="container mx-auto px-4 text-center">
                        <p className="text-yellow-300 text-sm">{antiCheatWarning}</p>
                    </div>
                </div>
            )}

            {/* Cut-Off Status Banner */}
            {eventConfig?.applyCutOff && !passedCutOff && currentAttempt <= eventConfig.cutOffAttempts && (
                <div className="bg-orange-900/50 border-b border-orange-700 py-2">
                    <div className="container mx-auto px-4 text-center">
                        <p className="text-orange-300 text-sm flex items-center justify-center gap-2">
                            <Clock className="h-4 w-4" />
                            <strong>Cut-Off Active:</strong> Beat {formatTimeDisplay(eventConfig.cutOffTime)} in {eventConfig.cutOffAttempts - currentAttempt + 1} remaining attempt(s)
                        </p>
                    </div>
                </div>
            )}

            {eventConfig?.applyCutOff && passedCutOff && (
                <div className="bg-green-900/50 border-b border-green-700 py-2">
                    <div className="container mx-auto px-4 text-center">
                        <p className="text-green-300 text-sm flex items-center justify-center gap-2">
                            <Check className="h-4 w-4" />
                            <strong>Cut-Off Passed!</strong> Continue with remaining solves.
                        </p>
                    </div>
                </div>
            )}

            {/* Max Time Warning */}
            {eventConfig?.applyMaxTime && (
                <div className="bg-purple-900/30 border-b border-purple-700 py-1">
                    <div className="container mx-auto px-4 text-center">
                        <p className="text-purple-300 text-xs flex items-center justify-center gap-2">
                            <Timer className="h-3 w-3" />
                            Max Time: {formatTimeDisplay(eventConfig.maxTimeLimit)} per solve
                        </p>
                    </div>
                </div>
            )}

            {/* Previous Solves */}
            {existingSolves.length > 0 && (
                <div className="container mx-auto px-4 py-2">
                    <div className="flex flex-wrap gap-2 justify-center">
                        {existingSolves.map((solve, i) => (
                            <Badge key={i} variant="outline" className={`border-gray-600 ${solve.reason === 'MAX_TIME_EXCEEDED' ? 'border-purple-500 text-purple-300' : ''
                                }`}>
                                Solve {solve.attemptNumber}: {solve.penalty === 'DNF' || solve.finalTime === null ? 'DNF' : formatTime(solve.finalTime)}
                                {solve.penalty === '+2' && ' (+2)'}
                                {solve.reason === 'MAX_TIME_EXCEEDED' && ' (Max)'}
                                {solve.flagged && ' ⚠️'}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-4">
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
                                <p className="text-sm text-gray-400 mb-2">Scramble #{currentAttempt}</p>

                                {/* Scramble Text Only - Visual Removed */}
                                <p className="text-2xl font-mono text-yellow-300 break-words bg-gray-900 p-4 rounded-lg border border-gray-700">
                                    {currentScramble || 'Scramble not yet released. Please try again shortly.'}
                                </p>
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
                                    <div className={`text-9xl font-bold tabular-nums ${inspectionTime < 0 ? 'text-red-500 animate-pulse' :
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
                                    <div className={`text-9xl font-bold tabular-nums ${eventConfig?.applyMaxTime && solveTime > eventConfig.maxTimeLimit * 0.8
                                            ? 'text-red-500'
                                            : eventConfig?.applyMaxTime && solveTime > eventConfig.maxTimeLimit * 0.5
                                                ? 'text-yellow-500'
                                                : 'text-green-500'
                                        }`}>
                                        {formatTime(solveTime)}
                                    </div>
                                    {eventConfig?.applyMaxTime && (
                                        <p className="text-gray-400 text-sm">
                                            Max: {formatTimeDisplay(eventConfig.maxTimeLimit)}
                                            {solveTime > eventConfig.maxTimeLimit * 0.8 && (
                                                <span className="text-red-400 ml-2">⚠️ Approaching limit!</span>
                                            )}
                                        </p>
                                    )}
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