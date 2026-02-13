'use client'

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Calendar, Trophy, DollarSign, Play } from 'lucide-react';
import { getEventName, getEventIcon } from '@/lib/wcaEvents';

declare global {
  interface Window {
    Razorpay: any;
  }
}

function CompetitionDetail() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [competition, setCompetition] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (params.competitionId) {
      fetchCompetition();
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
  }, []);

  async function fetchCompetition() {
    try {
      const compDoc = await getDoc(doc(db, 'competitions', params.competitionId));
      if (compDoc.exists()) {
        const data = compDoc.data();
        const now = new Date();
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        
        let status = 'UPCOMING';
        if (now >= start && now <= end) {
          status = 'LIVE';
        } else if (now > end) {
          status = 'ENDED';
        }
        
        setCompetition({ id: compDoc.id, ...data, status });
      }
    } catch (error) {
      console.error('Failed to fetch competition:', error);
    } finally {
      setLoading(false);
    }
  }

  async function checkRegistration() {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/competition/registration-status?userId=${user.uid}&competitionId=${params.competitionId}`);
      const data = await response.json();
      if (data.registered !== false) {
        setRegistration(data);
        setSelectedEvents(data.events || []);
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
      price = competition.flatPrice;
    } else if (competition.pricingModel === 'per_event') {
      price = competition.flatPrice * eventCount;
    } else if (competition.pricingModel === 'base_plus_extra') {
      if (eventCount > 0) {
        price = competition.basePrice + (competition.extraPrice * (eventCount - 1));
      }
    }

    setTotalPrice(price);
  }

  const handleEventToggle = (eventId) => {
    if (selectedEvents.includes(eventId)) {
      setSelectedEvents(selectedEvents.filter(e => e !== eventId));
    } else {
      setSelectedEvents([...selectedEvents, eventId]);
    }
  };

  async function handleRegisterFree() {
    if (selectedEvents.length === 0) {
      alert('Please select at least one event');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/competition/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          competitionId: params.competitionId,
          events: selectedEvents
        })
      });

      if (response.ok) {
        alert('Registration successful!');
        checkRegistration();
      } else {
        const error = await response.json();
        alert(error.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed');
    } finally {
      setProcessing(false);
    }
  }

  async function handlePayment() {
    if (selectedEvents.length === 0) {
      alert('Please select at least one event');
      return;
    }

    setProcessing(true);

    try {
      // Create order
      const orderResponse = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalPrice,
          currency: competition.currency,
          userId: user.uid,
          competitionId: params.competitionId,
          events: selectedEvents
        })
      });

      const order = await orderResponse.json();

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
              ...response,
              userId: user.uid,
              competitionId: params.competitionId,
              events: selectedEvents
            })
          });

          if (verifyResponse.ok) {
            alert('Payment successful! Registration complete.');
            checkRegistration();
          } else {
            alert('Payment verification failed');
          }
        },
        prefill: {
          name: userProfile?.displayName,
          email: userProfile?.email
        },
        theme: {
          color: '#3B82F6'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed');
    } finally {
      setProcessing(false);
    }
  }

  function handleStartCompetition() {
    if (!registration || !selectedEvents.length) return;
    router.push(`/compete/${params.competitionId}/${selectedEvents[0]}`);
  }

  if (loading) {
    return (
      <div className=\"min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center\">
        <div className=\"text-white text-xl\">Loading...</div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className=\"min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center\">
        <div className=\"text-white text-xl\">Competition not found</div>
      </div>
    );
  }

  const formatDate = (dateString) => {
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

  return (
    <div className=\"min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white\">
      <div className=\"container mx-auto px-4 py-8 max-w-5xl\">
        <Button
          variant=\"ghost\"
          onClick={() => router.push('/')}
          className=\"mb-6 text-gray-400 hover:text-white\"
        >
          <ArrowLeft className=\"h-4 w-4 mr-2\" />
          Back to Home
        </Button>

        <Card className=\"bg-gray-800 border-gray-700 mb-6\">
          <CardHeader>
            <div className=\"flex items-start justify-between\">
              <div className=\"flex-1\">
                <CardTitle className=\"text-3xl text-white mb-2\">{competition.name}</CardTitle>
                <CardDescription className=\"text-gray-400 text-lg\">
                  <div className=\"flex items-center gap-2 mt-2\">
                    <Calendar className=\"h-4 w-4\" />
                    {formatDate(competition.startDate)} - {formatDate(competition.endDate)}
                  </div>
                </CardDescription>
              </div>
              <Badge className={
                competition.status === 'LIVE' ? 'bg-green-500' :
                competition.status === 'UPCOMING' ? 'bg-yellow-500' : 'bg-gray-500'
              }>
                {competition.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {competition.description && (
              <p className=\"text-gray-300 mb-4\">{competition.description}</p>
            )}

            <div className=\"grid grid-cols-2 md:grid-cols-4 gap-4 mb-6\">
              <div className=\"bg-gray-700/50 p-3 rounded-lg\">
                <p className=\"text-gray-400 text-sm\">Events</p>
                <p className=\"text-white font-bold text-xl\">{competition.events?.length || 0}</p>
              </div>
              <div className=\"bg-gray-700/50 p-3 rounded-lg\">
                <p className=\"text-gray-400 text-sm\">Solve Limit</p>
                <p className=\"text-white font-bold text-xl\">{competition.solveLimit}</p>
              </div>
              <div className=\"bg-gray-700/50 p-3 rounded-lg\">
                <p className=\"text-gray-400 text-sm\">Type</p>
                <Badge className={competition.type === 'FREE' ? 'bg-green-600' : 'bg-yellow-600'}>
                  {competition.type}
                </Badge>
              </div>
              {competition.type === 'PAID' && (
                <div className=\"bg-gray-700/50 p-3 rounded-lg\">
                  <p className=\"text-gray-400 text-sm\">Price</p>
                  <p className=\"text-white font-bold text-xl\">
                    {getCurrencySymbol(competition.currency)}{competition.flatPrice || competition.basePrice}
                  </p>
                </div>
              )}
            </div>

            {competition.status === 'UPCOMING' && (
              <div className=\"bg-yellow-500/10 border border-yellow-500 text-yellow-500 px-4 py-3 rounded\">
                Competition will start on {formatDate(competition.startDate)}
              </div>
            )}

            {competition.status === 'ENDED' && (
              <div className=\"bg-gray-500/10 border border-gray-500 text-gray-400 px-4 py-3 rounded\">
                This competition has ended. View the leaderboard to see results.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Event Selection */}
        {competition.status !== 'ENDED' && !registration && (
          <Card className=\"bg-gray-800 border-gray-700 mb-6\">
            <CardHeader>
              <CardTitle className=\"text-white\">Select Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className=\"grid grid-cols-2 md:grid-cols-3 gap-4 mb-6\">
                {competition.events?.map(eventId => (
                  <div key={eventId} className=\"flex items-center space-x-2 bg-gray-700/50 p-3 rounded-lg\">
                    <Checkbox
                      id={eventId}
                      checked={selectedEvents.includes(eventId)}
                      onCheckedChange={() => handleEventToggle(eventId)}
                    />
                    <label htmlFor={eventId} className=\"cursor-pointer\">
                      {getEventIcon(eventId)} {getEventName(eventId)}
                    </label>
                  </div>
                ))}
              </div>

              {competition.type === 'PAID' && selectedEvents.length > 0 && (
                <div className=\"bg-blue-500/10 border border-blue-500 text-blue-400 px-4 py-3 rounded mb-4\">
                  <p className=\"font-bold\">Total Price: {getCurrencySymbol(competition.currency)}{totalPrice}</p>
                </div>
              )}

              {competition.status === 'LIVE' && (
                competition.type === 'FREE' ? (
                  <Button
                    onClick={handleRegisterFree}
                    disabled={processing || selectedEvents.length === 0}
                    className=\"w-full bg-green-600 hover:bg-green-700 py-6 text-lg\"
                  >
                    {processing ? 'Registering...' : 'Register (Free)'}
                  </Button>
                ) : (
                  <Button
                    onClick={handlePayment}
                    disabled={processing || selectedEvents.length === 0}
                    className=\"w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg\"
                  >
                    <DollarSign className=\"h-5 w-5 mr-2\" />
                    {processing ? 'Processing...' : `Pay ${getCurrencySymbol(competition.currency)}${totalPrice} & Register`}
                  </Button>
                )
              )}
            </CardContent>
          </Card>
        )}

        {/* Registered - Start Competition */}
        {registration && competition.status === 'LIVE' && (
          <Card className=\"bg-gray-800 border-gray-700 mb-6\">
            <CardContent className=\"py-6\">
              <div className=\"text-center space-y-4\">
                <Badge className=\"bg-green-600 text-lg px-4 py-2\">✓ Registered</Badge>
                <p className=\"text-gray-300\">You're registered for {registration.events?.length} event(s)</p>
                <Button
                  onClick={handleStartCompetition}
                  className=\"bg-blue-600 hover:bg-blue-700 py-6 px-8 text-lg\"
                >
                  <Play className=\"h-5 w-5 mr-2\" />
                  Start Competition
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leaderboard Button */}
        <Card className=\"bg-gray-800 border-gray-700\">
          <CardContent className=\"py-6 text-center\">
            <Button
              onClick={() => router.push(`/leaderboard/${params.competitionId}`)}
              variant=\"outline\"
              className=\"border-yellow-600 hover:bg-yellow-700\"
            >
              <Trophy className=\"h-5 w-5 mr-2\" />
              View Leaderboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default CompetitionDetail;
