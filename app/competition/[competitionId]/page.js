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
import { ArrowLeft, Calendar, Trophy, DollarSign, Play, Clock, Users, AlertCircle, Lock } from 'lucide-react';
import { getEventName, getEventIcon } from '@/lib/wcaEvents';
import Link from 'next/link';

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
  }, [selectedEvents, competition]);

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

    if (competition.pricingModel === 'flat') {
      price = competition.flatPrice || 0;
    } else if (competition.pricingModel === 'base_plus_extra') {
      if (eventCount > 0) {
        price = (competition.basePrice || 0) + ((competition.perEventPrice || 0) * Math.max(0, eventCount - 1));
      }
    }

    setTotalPrice(price);
  }

  // Get registration status
  function getRegistrationStatus() {
    if (!competition) return { canRegister: false, message: 'Loading...' };

    const now = new Date();
    const regOpen = competition.registrationOpenDate ? new Date(competition.registrationOpenDate) : null;
    const regClose = competition.registrationCloseDate ? new Date(competition.registrationCloseDate) : null;

    if (!regOpen || !regClose) {
      // Fallback to legacy dates
      return { canRegister: true, message: '', status: 'open' };
    }

    if (now < regOpen) {
      return {
        canRegister: false,
        message: `Registration opens on ${formatDate(competition.registrationOpenDate)}`,
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

    return { canRegister: true, message: '', status: 'open' };
  }

  // Get competition status
  function getCompetitionStatus() {
    if (!competition) return { canCompete: false, message: 'Loading...' };

    const now = new Date();
    const compStart = competition.competitionStartDate ? new Date(competition.competitionStartDate) : 
                      (competition.startDate ? new Date(competition.startDate) : null);
    const compEnd = competition.competitionEndDate ? new Date(competition.competitionEndDate) :
                    (competition.endDate ? new Date(competition.endDate) : null);

    if (!compStart || !compEnd) {
      return { canCompete: true, message: '', status: 'live' };
    }

    if (now < compStart) {
      return {
        canCompete: false,
        message: `Competition starts on ${formatDate(competition.competitionStartDate || competition.startDate)}`,
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

    return { canCompete: true, message: '', status: 'live' };
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

    if (selectedEvents.length === 0) {
      alert('Please select at least one event');
      return;
    }

    setProcessing(true);
    try {
      // Create registration
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

      // Update competition participant count
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

    if (selectedEvents.length === 0) {
      alert('Please select at least one event');
      return;
    }

    setProcessing(true);

    try {
      // Create order via API
      const orderResponse = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalPrice,
          currency: competition.currency || 'INR',
          userId: user.uid,
          competitionId: params.competitionId,
          events: selectedEvents
        })
      });

      const order = await orderResponse.json();
      
      if (!order.id) {
        throw new Error(order.error || 'Failed to create order');
      }

      // Razorpay checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'MCUBES',
        description: competition.name,
        order_id: order.id,
        handler: async function (response) {
          // Verify payment
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
            // Save registration after successful payment
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

            // Save payment record
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

            // Update participant count
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
      {/* Header */}
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
              <Link href="/competitions" className="text-blue-600 font-semibold">Competitions</Link>
              <Link href="/rankings" className="text-gray-600 hover:text-gray-900 font-medium">Rankings</Link>
            </nav>

            <div className="flex items-center gap-3">
              {user ? (
                <Button variant="outline" size="sm" onClick={() => router.push('/profile')}>
                  {userProfile?.displayName || 'Profile'}
                </Button>
              ) : (
                <Button onClick={() => router.push('/auth/login')} className="bg-blue-600">
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

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
                        className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedEvents.includes(eventId) 
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
                          {getEventIcon(eventId)} {getEventName(eventId)}
                        </label>
                      </div>
                    ))}
                  </div>

                  {/* Pricing Display */}
                  {competition.type === 'PAID' && selectedEvents.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-4">
                      <p className="text-sm mb-1">
                        {competition.pricingModel === 'flat' ? 'Flat fee' : `Base fee + ${getCurrencySymbol(competition.currency)}${competition.perEventPrice || 0} per additional event`}
                      </p>
                      <p className="font-bold text-xl">Total: {getCurrencySymbol(competition.currency)}{totalPrice}</p>
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
                      onClick={handlePayment}
                      disabled={processing || selectedEvents.length === 0}
                      className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg"
                    >
                      <DollarSign className="h-5 w-5 mr-2" />
                      {processing ? 'Processing...' : `Pay ${getCurrencySymbol(competition.currency)}${totalPrice} & Register`}
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
                      {getEventIcon(eventId)} {getEventName(eventId)}
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
