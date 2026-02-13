'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Users } from 'lucide-react';
import { WCA_EVENTS } from '@/lib/wcaEvents';
import { Checkbox } from '@/components/ui/checkbox';

function AdminPanel() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('create');
  const [competitions, setCompetitions] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Competition form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    type: 'FREE', // FREE or PAID
    pricingModel: 'flat', // flat, per_event, base_plus_extra
    flatPrice: 0,
    basePrice: 0,
    extraPrice: 0,
    currency: 'INR',
    solveLimit: 5,
    selectedEvents: [],
    scrambles: {} // { eventId: [scr1, scr2, scr3, scr4, scr5] }
  });

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/');
    }
  }, [isAdmin, loading, router]);

  useEffect(() => {
    if (isAdmin) {
      fetchCompetitions();
    }
  }, [isAdmin]);

  async function fetchCompetitions() {
    try {
      const compsRef = collection(db, 'competitions');
      const snapshot = await getDocs(compsRef);
      const compsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort client-side
      compsData.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
      });
      setCompetitions(compsData);
    } catch (error) {
      console.error('Failed to fetch competitions:', error);
      setCompetitions([]);
    } finally {
      setLoadingData(false);
    }
  }

  const handleEventToggle = (eventId) => {
    const selected = formData.selectedEvents.includes(eventId);
    if (selected) {
      setFormData({
        ...formData,
        selectedEvents: formData.selectedEvents.filter(e => e !== eventId),
        scrambles: { ...formData.scrambles, [eventId]: undefined }
      });
    } else {
      setFormData({
        ...formData,
        selectedEvents: [...formData.selectedEvents, eventId],
        scrambles: { ...formData.scrambles, [eventId]: ['', '', '', '', ''] }
      });
    }
  };

  const handleScrambleChange = (eventId, index, value) => {
    const newScrambles = { ...formData.scrambles };
    newScrambles[eventId][index] = value;
    setFormData({ ...formData, scrambles: newScrambles });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (formData.selectedEvents.length === 0) {
      alert('Please select at least one event');
      return;
    }

    // Check all scrambles are filled
    for (const eventId of formData.selectedEvents) {
      const scrambles = formData.scrambles[eventId];
      if (!scrambles || scrambles.some(s => !s.trim())) {
        alert(`Please enter all 5 scrambles for ${eventId}`);
        return;
      }
    }

    try {
      await addDoc(collection(db, 'competitions'), {
        name: formData.name,
        description: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate,
        type: formData.type,
        pricingModel: formData.pricingModel,
        flatPrice: parseFloat(formData.flatPrice) || 0,
        basePrice: parseFloat(formData.basePrice) || 0,
        extraPrice: parseFloat(formData.extraPrice) || 0,
        currency: formData.currency,
        solveLimit: parseInt(formData.solveLimit),
        events: formData.selectedEvents,
        scrambles: formData.scrambles,
        createdAt: new Date().toISOString(),
        participantCount: 0
      });

      alert('Competition created successfully!');
      fetchCompetitions();
      // Reset form
      setFormData({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        type: 'FREE',
        pricingModel: 'flat',
        flatPrice: 0,
        basePrice: 0,
        extraPrice: 0,
        currency: 'INR',
        solveLimit: 5,
        selectedEvents: [],
        scrambles: {}
      });
    } catch (error) {
      console.error('Failed to create competition:', error);
      alert('Failed to create competition');
    }
  };

  const handleDelete = async (compId) => {
    if (!confirm('Are you sure you want to delete this competition?')) return;

    try {
      await deleteDoc(doc(db, 'competitions', compId));
      fetchCompetitions();
    } catch (error) {
      console.error('Failed to delete competition:', error);
      alert('Failed to delete competition');
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/')}
          className="mb-6 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>

        <h1 className="text-4xl font-bold mb-8">Admin Panel</h1>

        <div className="flex gap-4 mb-6">
          <Button
            variant={activeTab === 'create' ? 'default' : 'outline'}
            onClick={() => setActiveTab('create')}
            className={activeTab === 'create' ? 'bg-blue-600' : 'border-gray-600'}
          >
            Create Competition
          </Button>
          <Button
            variant={activeTab === 'manage' ? 'default' : 'outline'}
            onClick={() => setActiveTab('manage')}
            className={activeTab === 'manage' ? 'bg-blue-600' : 'border-gray-600'}
          >
            Manage Competitions
          </Button>
        </div>

        {activeTab === 'create' && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Create New Competition</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label className="text-white">Competition Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label className="text-white">Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="bg-gray-700 border-gray-600 text-white"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Start Date & Time *</Label>
                    <Input
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">End Date & Time *</Label>
                    <Input
                      type="datetime-local"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      required
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Competition Type</Label>
                    <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FREE">FREE</SelectItem>
                        <SelectItem value="PAID">PAID</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.type === 'PAID' && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-white">Pricing Model</Label>
                        <Select value={formData.pricingModel} onValueChange={(value) => setFormData({ ...formData, pricingModel: value })}>
                          <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="flat">Flat Price (Entire Competition)</SelectItem>
                            <SelectItem value="per_event">Per Event</SelectItem>
                            <SelectItem value="base_plus_extra">Base + Extra Per Event</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white">Currency</Label>
                        <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                          <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INR">INR (₹)</SelectItem>
                            <SelectItem value="USD">USD ($)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.pricingModel === 'flat' && (
                        <div className="space-y-2">
                          <Label className="text-white">Price</Label>
                          <Input
                            type="number"
                            value={formData.flatPrice}
                            onChange={(e) => setFormData({ ...formData, flatPrice: e.target.value })}
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                        </div>
                      )}

                      {formData.pricingModel === 'per_event' && (
                        <div className="space-y-2">
                          <Label className="text-white">Price Per Event</Label>
                          <Input
                            type="number"
                            value={formData.flatPrice}
                            onChange={(e) => setFormData({ ...formData, flatPrice: e.target.value })}
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                        </div>
                      )}

                      {formData.pricingModel === 'base_plus_extra' && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-white">Base Price (First Event)</Label>
                            <Input
                              type="number"
                              value={formData.basePrice}
                              onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                              className="bg-gray-700 border-gray-600 text-white"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white">Extra Per Additional Event</Label>
                            <Input
                              type="number"
                              value={formData.extraPrice}
                              onChange={(e) => setFormData({ ...formData, extraPrice: e.target.value })}
                              className="bg-gray-700 border-gray-600 text-white"
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}

                  <div className="space-y-2">
                    <Label className="text-white">Solve Limit (Ao5 = 5)</Label>
                    <Input
                      type="number"
                      value={formData.solveLimit}
                      onChange={(e) => setFormData({ ...formData, solveLimit: e.target.value })}
                      min="1"
                      max="100"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-white text-lg">Select Events *</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {WCA_EVENTS.map(event => (
                      <div key={event.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={event.id}
                          checked={formData.selectedEvents.includes(event.id)}
                          onCheckedChange={() => handleEventToggle(event.id)}
                        />
                        <label htmlFor={event.id} className="text-sm cursor-pointer">
                          {event.icon} {event.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {formData.selectedEvents.length > 0 && (
                  <div className="space-y-6">
                    <Label className="text-white text-lg">Enter Scrambles (5 per event) *</Label>
                    {formData.selectedEvents.map(eventId => {
                      const event = WCA_EVENTS.find(e => e.id === eventId);
                      return (
                        <div key={eventId} className="space-y-3 p-4 bg-gray-700/50 rounded-lg">
                          <h3 className="font-semibold">{event?.icon} {event?.name}</h3>
                          {[0, 1, 2, 3, 4].map(i => (
                            <div key={i} className="space-y-1">
                              <Label className="text-gray-400 text-sm">Scramble {i + 1}</Label>
                              <Textarea
                                value={formData.scrambles[eventId]?.[i] || ''}
                                onChange={(e) => handleScrambleChange(eventId, i, e.target.value)}
                                placeholder="Enter scramble..."
                                className="bg-gray-700 border-gray-600 text-white font-mono text-sm"
                                rows={2}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg">
                  <Plus className="h-5 w-5 mr-2" />
                  Create Competition
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {activeTab === 'manage' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">All Competitions</h2>
            {competitions.length === 0 ? (
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="py-12 text-center text-gray-400">
                  No competitions created yet
                </CardContent>
              </Card>
            ) : (
              competitions.map(comp => (
                <Card key={comp.id} className="bg-gray-800 border-gray-700">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-2">{comp.name}</h3>
                        <div className="flex gap-4 text-sm text-gray-400">
                          <span>{new Date(comp.startDate).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>{comp.events?.length || 0} events</span>
                          <span>•</span>
                          <Badge className={comp.type === 'FREE' ? 'bg-green-600' : 'bg-yellow-600'}>
                            {comp.type}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(comp.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
