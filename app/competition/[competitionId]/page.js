'use client'

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar, Trophy, DollarSign, Play, Clock, Users, AlertCircle, Lock, Info, Timer } from 'lucide-react';
import { getEventName } from '@/lib/wcaEvents';
import EventIcon from '@/lib/EventIcon';
import Link from 'next/link';

// Helper to format time from milliseconds
function formatTimeDisplay(ms) {
    if (ms === null || ms === undefined || ms === 0) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function CompetitionDetail() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const [competition, setCompetition] = useState(null);
    const [registration, setRegistration] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedEvents, setSelectedEvents] = useState([]);
    const [totalPrice, setTotalPrice] = useState(0);
    const [processing, setProcessing] = useState(false);
    const [participantCount, setParticipantCount] = useState(0);
    const [payInUSD, setPayInUSD] = useState(false);

    useEffect(() => {
        if (params.competitionId) {
            fetchCompetition();
            fetchParticipantCount();
        }
    }, [params.competitionId]);

    useEffect(() => {
        if (params.competitionId && user) {
            checkRegistration();
        }
    }, [params.competitionId, user]);

    useEffect(() => {
        calculatePrice();
    }, [selectedEvents, competition, payInUSD]);

    // Load Razorpay script
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        return () => {
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
    }, []);

    async function fetchCompetition() {
        try {
            const compDoc = await getDoc(doc(db, 'competitions', params.competitionId));
            if (compDoc.exists()) {
                const data = compDoc.data();
                setCompetition({ id: compDoc.id, ...data });
            }
        } catch (error) {
            console.error('Failed to fetch competition:', error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchParticipantCount() {
        try {
            const regsQuery = query(
                collection(db, 'registrations'),
                where('competitionId', '==', params.competitionId)
            );
            const snapshot = await getDocs(regsQuery);
            setParticipantCount(snapshot.size);
        } catch (error) {
            console.error('Failed to fetch participant count:', error);
        }
    }

    async function checkRegistration() {
        if (!user) return;

        try {
            const regsQuery = query(
                collection(db, 'registrations'),
                where('userId', '==', user.uid),
                where('competitionId', '==', params.competitionId)
            );
            const snapshot = await getDocs(regsQuery);

            if (!snapshot.empty) {
                const regData = snapshot.docs[0].data();
                setRegistration({ id: snapshot.docs[0].id, ...regData });
                setSelectedEvents(regData.events || []);
            }
        } catch (error) {
            console.error('Failed to check registration:', error);
        }
    }

    function calculatePrice() {
        if (!competition || competition.type === 'FREE') {
            setTotalPrice(0);
            return;
        }

        let price = 0;
        const eventCount = selectedEvents.length;

        let base = Number(competition.basePrice) || 0;
        let perEvent = Number(competition.perEventPrice) || 0;
        let flat = Number(competition.flatPrice) || 0;
        let regFee = Number(competition.registrationFee) || 0;

        const compCurrency = competition.currency || 'INR';
        const targetCurrency = payInUSD ? 'USD' : 'INR';

        if (compCurrency !== targetCurrency) {
            if (compCurrency === 'INR' && targetCurrency === 'USD') {
                base = base / 90;
                perEvent = perEvent / 90;
                flat = flat / 90;
                regFee = regFee / 90;
            } else if (compCurrency === 'USD' && targetCurrency === 'INR') {
                base = base * 90;
                perEvent = perEvent * 90;
                flat = flat * 90;
                regFee = regFee * 90;
            }
        }

        if (competition.pricingModel === 'flat') {
            price = flat;
        } else if (competition.pricingModel === 'base_plus_extra') {
            const extraEvents = Math.max(0, eventCount - 1);
            price = base + (extraEvents * perEvent);
        }

        if (price === 0 && regFee) {
            price = regFee;
        }

        setTotalPrice(Math.round(price * 100) / 100);
    }

    function getRegistrationStatus() {
        if (!competition) return { canRegister: false, message: 'Loading...' };

        const now = new Date();
        const regOpen = competition.registrationStartDate ? new Date(competition.registrationStartDate) : null;
        const regClose = competition.registrationEndDate ? new Date(competition.registrationEndDate) : null;

        if (!regOpen || !regClose) {
            return { canRegister: true, message: 'Registration Open', status: 'open' };
        }

        if (now < regOpen) {
            return {
                canRegister: false,
                message: `Registration opens on ${formatDate(regOpen)}`,
                status: 'not_opened'
            };
        }

        if (now > regClose) {
            return {
                canRegister: false,
                message: 'Registration has closed',
                status: 'closed'
            };
        }

        return { canRegister: true, message: 'Registration Open', status: 'open' };
    }

    function getCompetitionStatus() {
        if (!competition) return { canCompete: false, message: 'Loading...' };

        const now = new Date();
        const compStart = competition.startDate ? new Date(competition.startDate) : null;
        const compEnd = competition.endDate ? new Date(competition.endDate) : null;

        if (!compStart || !compEnd) {
            return { canCompete: true, message: 'Live', status: 'live' };
        }

        if (now < compStart) {
            return {
                canCompete: false,
                message: `Competition starts on ${formatDate(compStart)}`,
                status: 'upcoming'
            };
        }

        if (now > compEnd) {
            return {
                canCompete: false,
                message: 'Competition has ended',
                status: 'ended'
            };
        }

        return { canCompete: true, message: 'Competition is Live', status: 'live' };
    }

    const handleEventToggle = (eventId) => {
        if (selectedEvents.includes(eventId)) {
            setSelectedEvents(selectedEvents.filter(e => e !== eventId));
        } else {
            setSelectedEvents([...selectedEvents, eventId]);
        }
    };

    async function handleRegisterFree() {
        if (!user) {
            router.push('/auth/login');
            return;
        }

        if (userProfile?.status === 'SUSPENDED') {
            alert('Your account is suspended. You cannot register for competitions.');
            return;
        }

        if (selectedEvents.length === 0) {
            alert('Please select at least one event');
            return;
        }

        setProcessing(true);
        try {
            await addDoc(collection(db, 'registrations'), {
                userId: user.uid,
                userEmail: user.email,
                userName: userProfile?.displayName || 'Unknown',
                wcaStyleId: userProfile?.wcaStyleId || 'N/A',
                competitionId: params.competitionId,
                competitionName: competition.name,
                events: selectedEvents,
                type: 'FREE',
                status: 'CONFIRMED',
                createdAt: new Date().toISOString()
            });

            try {
                await updateDoc(doc(db, 'competitions', params.competitionId), {
                    participantCount: increment(1)
                });
            } catch (e) {
                console.log('Could not update participant count');
            }

            alert('Registration successful!');
            checkRegistration();
            fetchParticipantCount();
        } catch (error) {
            console.error('Registration error:', error);
            alert('Registration failed: ' + error.message);
        } finally {
            setProcessing(false);
        }
    }

    async function handlePayment() {
        if (!user) {
            router.push('/auth/login');
            return;
        }

        if (userProfile?.status === 'SUSPENDED') {
            alert('Your account is suspended. You cannot register for competitions.');
            return;
        }

        if (selectedEvents.length === 0) {
            alert('Please select at least one event');
            return;
        }

        setProcessing(true);

        try {
            const orderResponse = await fetch('/api/payment/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: totalPrice,
                    currency: payInUSD ? 'USD' : 'INR',
                    userId: user.uid,
                    competitionId: params.competitionId,
                    events: selectedEvents
                })
            });

            if (!orderResponse.ok) {
                let errorMessage = `Payment failed (${orderResponse.status})`;
                try {
                    const text = await orderResponse.text();
                    try {
                        const data = JSON.parse(text);
                        errorMessage = data.error || data.message || errorMessage;
                    } catch {
                        if (text && text.length < 100) errorMessage = text;
                        else errorMessage = `Server Error (${orderResponse.status}): Please check logs`;
                    }
                } catch (e) {
                    console.error("Failed to read error response", e);
                }
                console.error('Payment API error:', errorMessage);
                throw new Error(errorMessage);
            }

            const order = await orderResponse.json();

            if (!order.id) {
                throw new Error(order.error || 'Failed to create order');
            }

            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                amount: order.amount,
                currency: order.currency,
                name: 'MCUBES',
                description: competition.name,
                order_id: order.id,
                handler: async function (response) {
                    const verifyResponse = await fetch('/api/payment/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            userId: user.uid,
                            competitionId: params.competitionId,
                            events: selectedEvents
                        })
                    });

                    if (verifyResponse.ok) {
                        await addDoc(collection(db, 'registrations'), {
                            userId: user.uid,
                            userEmail: user.email,
                            userName: userProfile?.displayName || 'Unknown',
                            wcaStyleId: userProfile?.wcaStyleId || 'N/A',
                            competitionId: params.competitionId,
                            competitionName: competition.name,
                            events: selectedEvents,
                            type: 'PAID',
                            status: 'CONFIRMED',
                            paymentId: response.razorpay_payment_id,
                            createdAt: new Date().toISOString()
                        });

                        await addDoc(collection(db, 'payments'), {
                            userId: user.uid,
                            userEmail: user.email,
                            userName: userProfile?.displayName || 'Unknown',
                            competitionId: params.competitionId,
                            competitionName: competition.name,
                            amount: totalPrice,
                            currency: competition.currency || 'INR',
                            paymentId: response.razorpay_payment_id,
                            orderId: response.razorpay_order_id,
                            status: 'SUCCESS',
                            createdAt: new Date().toISOString()
                        });

                        try {
                            await updateDoc(doc(db, 'competitions', params.competitionId), {
                                participantCount: increment(1)
                            });
                        } catch (e) {
                            console.log('Could not update participant count');
                        }

                        alert('Payment successful! Registration complete.');
                        checkRegistration();
                        fetchParticipantCount();
                    } else {
                        const error = await verifyResponse.json();
                        alert('Payment verification failed: ' + (error.error || 'Unknown error'));
                    }
                },
                prefill: {
                    name: userProfile?.displayName || '',
                    email: user.email || ''
                },
                theme: {
                    color: '#3B82F6'
                }
            };

            if (typeof window !== 'undefined' && window.Razorpay) {
                const rzp = new window.Razorpay(options);
                rzp.open();
            } else {
                alert('Razorpay not loaded. Please refresh and try again.');
            }
        } catch (error) {
            console.error('Payment error:', error);
            alert('Payment failed: ' + error.message);
        } finally {
            setProcessing(false);
        }
    }

    function handleStartCompetition() {
        if (!registration || !selectedEvents.length) return;
        router.push(`/compete/${params.competitionId}/${selectedEvents[0]}`);
    }

    const formatDate = (dateString) => {
        if (!dateString) return 'TBD';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getCurrencySymbol = (currency) => {
        return currency === 'INR' ? '₹' : '$';
    };

    // Get event settings for display
    const getEventSettings = (eventId) => {
        return competition?.eventSettings?.[eventId] || null;
    };

    const regStatus = getRegistrationStatus();
    const compStatus = getCompetitionStatus();

    if (loading || authLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-gray-500 text-xl">Loading...</div>
            </div>
        );
    }

    if (!competition) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-gray-500 text-xl mb-4">Competition not found</div>
                    <Button onClick={() => router.push('/competitions')}>Back to Competitions</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8 max-w-5xl">
                <Button
                    variant="ghost"
                    onClick={() => router.push('/competitions')}
                    className="mb-6 text-gray-600 hover:text-gray-900"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Competitions
                </Button>

                {/* Competition Header Card */}
                <Card className="mb-6">
                    <CardHeader>
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <Badge variant="outline">ONLINE</Badge>
                                    <Badge className={
                                        compStatus.status === 'live' ? 'bg-green-100 text-green-700' :
                                            compStatus.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                                    }>
                                        {compStatus.status?.toUpperCase()}
                                    </Badge>
                                    <Badge className={
                                        regStatus.status === 'open' ? 'bg-blue-100 text-blue-700' :
                                            regStatus.status === 'closed' ? 'bg-red-100 text-red-700' :
                                                'bg-orange-100 text-orange-700'
                                    }>
                                        REG: {regStatus.status === 'open' ? 'OPEN' : regStatus.status === 'closed' ? 'CLOSED' : 'NOT YET'}
                                    </Badge>
                                    <Badge className={competition.type === 'FREE' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}>
                                        {competition.type === 'FREE' ? 'FREE' : 'PAID'}
                                    </Badge>
                                </div>
                                <CardTitle className="text-3xl text-gray-900 mb-2">{competition.name}</CardTitle>
                                <CardDescription className="text-gray-600 text-lg">
                                    <div className="flex items-center gap-2 mt-2">
                                        <Calendar className="h-4 w-4" />
                                        {formatDate(competition.competitionStartDate || competition.startDate)} - {formatDate(competition.competitionEndDate || competition.endDate)}
                                    </div>
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {competition.description && (
                            <p className="text-gray-600 mb-6">{competition.description}</p>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-gray-50 p-4 rounded-lg text-center">
                                <Trophy className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                                <p className="text-2xl font-bold text-gray-900">{competition.events?.length || 0}</p>
                                <p className="text-gray-500 text-sm">Events</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg text-center">
                                <Clock className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                                <p className="text-2xl font-bold text-gray-900">Ao{competition.solveLimit || 5}</p>
                                <p className="text-gray-500 text-sm">Format</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg text-center">
                                <Users className="h-6 w-6 mx-auto mb-2 text-green-500" />
                                <p className="text-2xl font-bold text-gray-900">{participantCount}</p>
                                <p className="text-gray-500 text-sm">Participants</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg text-center">
                                <DollarSign className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
                                <p className="text-2xl font-bold text-gray-900">
                                    {competition.type === 'FREE' ? 'FREE' : `${getCurrencySymbol(competition.currency)}${competition.flatPrice || competition.basePrice || 0}+`}
                                </p>
                                <p className="text-gray-500 text-sm">Entry Fee</p>
                            </div>
                        </div>

                        {/* Registration Status Messages */}
                        {!registration && regStatus.status === 'not_opened' && (
                            <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                <span><strong>Registration Not Open Yet:</strong> {regStatus.message}</span>
                            </div>
                        )}

                        {!registration && regStatus.status === 'closed' && (
                            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                                <AlertCircle className="h-5 w-5" />
                                <span><strong>Registration Closed:</strong> {regStatus.message}</span>
                            </div>
                        )}

                        {compStatus.status === 'ended' && (
                            <div className="bg-gray-50 border border-gray-200 text-gray-600 px-4 py-3 rounded-lg mb-4">
                                This competition has ended. View the leaderboard to see results.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Event Rules & Time Limits Card */}
                {competition.events && competition.events.length > 0 && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Timer className="h-5 w-5 text-orange-500" />
                                Event Rules & Time Limits
                            </CardTitle>
                            <CardDescription>
                                WCA-style cut-off and maximum time limits apply to certain events
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4">
                                {competition.events.map(eventId => {
                                    const settings = getEventSettings(eventId);
                                    const hasCutOff = settings?.applyCutOff;
                                    const hasMaxTime = settings?.applyMaxTime;

                                    return (
                                        <div key={eventId} className="border rounded-lg p-4 bg-white">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="font-semibold text-gray-900">
                                                    <EventIcon eventId={eventId} size={20} /> {getEventName(eventId)}
                                                </h3>
                                                <Badge variant="outline">{settings?.format || 'Ao5'}</Badge>
                                            </div>

                                            {(hasCutOff || hasMaxTime) ? (
                                                <div className="space-y-2 text-sm">
                                                    {hasCutOff && (
                                                        <div className="flex items-center gap-2 text-orange-700 bg-orange-50 px-3 py-2 rounded">
                                                            <Clock className="h-4 w-4" />
                                                            <span>
                                                                <strong>Cut-Off:</strong> {formatTimeDisplay(settings.cutOffTime)} ({settings.cutOffAttempts} attempt{settings.cutOffAttempts > 1 ? 's' : ''} to beat)
                                                            </span>
                                                        </div>
                                                    )}
                                                    {hasMaxTime && (
                                                        <div className="flex items-center gap-2 text-red-700 bg-red-50 px-3 py-2 rounded">
                                                            <Timer className="h-4 w-4" />
                                                            <span>
                                                                <strong>Maximum Time:</strong> {formatTimeDisplay(settings.maxTimeLimit)} per solve
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-500">No time limits configured</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Event Selection - Only show if can register and not registered */}
                {!registration && regStatus.canRegister && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Select Events to Register</CardTitle>
                            <CardDescription>
                                {user ? 'Choose the events you want to compete in' : 'Please sign in to register'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!user ? (
                                <div className="text-center py-8">
                                    <p className="text-gray-500 mb-4">You need to sign in to register for this competition</p>
                                    <Button onClick={() => router.push('/auth/login')} className="bg-blue-600">
                                        Sign In to Register
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                                        {(competition.events || []).map(eventId => (
                                            <div
                                                key={eventId}
                                                className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedEvents.includes(eventId)
                                                        ? 'border-blue-500 bg-blue-50'
                                                        : 'border-gray-200 hover:border-blue-200'
                                                    }`}
                                                onClick={() => handleEventToggle(eventId)}
                                            >
                                                <Checkbox
                                                    id={eventId}
                                                    checked={selectedEvents.includes(eventId)}
                                                    onCheckedChange={() => handleEventToggle(eventId)}
                                                />
                                                <label htmlFor={eventId} className="cursor-pointer font-medium">
                                                    <EventIcon eventId={eventId} size={20} /> {getEventName(eventId)}
                                                </label>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Pricing Display */}
                                    {competition.type === 'PAID' && selectedEvents.length > 0 && (
                                        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-4">
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="font-semibold">Pricing Breakdown:</span>

                                                <div className="flex items-center gap-2">
                                                    <Label htmlFor="currency-mode" className="text-xs font-medium text-blue-700">INR</Label>
                                                    <Switch
                                                        id="currency-mode"
                                                        checked={payInUSD}
                                                        onCheckedChange={setPayInUSD}
                                                    />
                                                    <Label htmlFor="currency-mode" className="text-xs font-medium text-blue-700">USD</Label>
                                                </div>
                                            </div>

                                            {competition.pricingModel === 'flat' ? (
                                                <p className="text-sm">Flat Registration Fee</p>
                                            ) : (
                                                <ul className="text-sm space-y-1 list-disc list-inside">
                                                    <li>Base Fee (includes 1 event): {payInUSD ? '$' : '₹'}{
                                                        (() => {
                                                            const base = Number(competition.basePrice) || 0;
                                                            const compCur = competition.currency || 'INR';
                                                            if (payInUSD && compCur === 'INR') return (base / 90).toFixed(2);
                                                            if (!payInUSD && compCur === 'USD') return (base * 90).toFixed(0);
                                                            return base;
                                                        })()
                                                    }</li>
                                                    <li>Extra Events: {Math.max(0, selectedEvents.length - 1)} x {payInUSD ? '$' : '₹'}{
                                                        (() => {
                                                            const pe = Number(competition.perEventPrice) || 0;
                                                            const compCur = competition.currency || 'INR';
                                                            if (payInUSD && compCur === 'INR') return (pe / 90).toFixed(2);
                                                            if (!payInUSD && compCur === 'USD') return (pe * 90).toFixed(0);
                                                            return pe;
                                                        })()
                                                    }</li>
                                                </ul>
                                            )}

                                            <div className="mt-3 pt-3 border-t border-blue-200 flex justify-between items-end">
                                                <span className="text-sm text-blue-600">Total Amount:</span>
                                                <div className="text-right">
                                                    <span className="font-bold text-2xl">
                                                        {payInUSD ? '$' : '₹'}{totalPrice}
                                                    </span>
                                                    <p className="text-xs text-blue-500 mt-1 opacity-80">
                                                        {payInUSD ? 'Paid via INR Gateway (Converted)' : 'Standard Rate'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {competition.type === 'FREE' ? (
                                        <Button
                                            onClick={handleRegisterFree}
                                            disabled={processing || selectedEvents.length === 0}
                                            className="w-full bg-green-600 hover:bg-green-700 py-6 text-lg"
                                        >
                                            {processing ? 'Registering...' : 'Register (Free)'}
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={() => handlePayment()}
                                            disabled={processing || selectedEvents.length === 0}
                                            className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg"
                                        >
                                            <DollarSign className="h-5 w-5 mr-2" />
                                            {processing ? 'Processing...' : `Pay ${payInUSD ? '$' : '₹'}${totalPrice} & Register`}
                                        </Button>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Registered - Start Competition */}
                {registration && (
                    <Card className="mb-6 border-green-200 bg-green-50">
                        <CardContent className="py-6">
                            <div className="text-center space-y-4">
                                <Badge className="bg-green-600 text-white text-lg px-4 py-2">✓ Registered</Badge>
                                <p className="text-gray-700">You are registered for {registration.events?.length || 0} event(s):</p>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {(registration.events || []).map(eventId => (
                                        <Badge key={eventId} variant="outline" className="bg-white">
                                            <EventIcon eventId={eventId} size={18} /> {getEventName(eventId)}
                                        </Badge>
                                    ))}
                                </div>

                                {compStatus.canCompete ? (
                                    <Button
                                        onClick={handleStartCompetition}
                                        className="bg-blue-600 hover:bg-blue-700 py-6 px-8 text-lg"
                                    >
                                        <Play className="h-5 w-5 mr-2" />
                                        Start Competition
                                    </Button>
                                ) : compStatus.status === 'upcoming' ? (
                                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg inline-flex items-center gap-2">
                                        <Lock className="h-5 w-5" />
                                        <span>{compStatus.message}</span>
                                    </div>
                                ) : (
                                    <p className="text-gray-600">{compStatus.message}</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Leaderboard Button */}
                <Card>
                    <CardContent className="py-6 text-center">
                        <Button
                            onClick={() => router.push(`/leaderboard/${params.competitionId}`)}
                            variant="outline"
                            className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                        >
                            <Trophy className="h-5 w-5 mr-2" />
                            View Leaderboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default CompetitionDetail;