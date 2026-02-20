'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft } from 'lucide-react'
import { WCA_EVENTS, getEventName } from '@/lib/wcaEvents'

function CreateCompetition() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        startDate: '',
        endDate: '',
        registrationStartDate: '',
        registrationEndDate: '',
        type: 'FREE',
        currency: 'INR',
        pricingModel: 'flat',
        flatPrice: 0,
        basePrice: 0,
        perEventPrice: 0,
        solveLimit: 5,
        selectedEvents: [],
        scramble1: '',
        scramble2: '',
        scramble3: '',
        scramble4: '',
        scramble5: ''
    })

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))

        // Auto-generate slug from name
        if (name === 'name' && !formData.slug) {
            const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
            setFormData(prev => ({ ...prev, slug }))
        }
    }

    const handleEventToggle = (eventId) => {
        setFormData(prev => {
            const newEvents = prev.selectedEvents.includes(eventId)
                ? prev.selectedEvents.filter(id => id !== eventId)
                : [...prev.selectedEvents, eventId];
            return { ...prev, selectedEvents: newEvents };
        });
    };

    async function handleSubmit(e) {
        e.preventDefault()
        if (formData.selectedEvents.length === 0) return alert('Please select at least one event');

        setLoading(true)

        try {
            // In this simple create page, we're just using 5 textareas for simplicity
            // In a real app, you'd map these to specific events like the dashboard does
            const scrambles = {
                [formData.selectedEvents[0]]: [
                    formData.scramble1,
                    formData.scramble2,
                    formData.scramble3,
                    formData.scramble4,
                    formData.scramble5
                ]
            }

            const response = await fetch('/api/competitions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    slug: formData.slug,
                    startDate: formData.startDate,
                    endDate: formData.endDate,
                    registrationStartDate: formData.registrationStartDate,
                    registrationEndDate: formData.registrationEndDate,
                    type: formData.type,
                    currency: formData.currency,
                    pricingModel: formData.pricingModel,
                    flatPrice: Number(formData.flatPrice),
                    basePrice: Number(formData.basePrice),
                    perEventPrice: Number(formData.perEventPrice),
                    solveLimit: Number(formData.solveLimit),
                    events: formData.selectedEvents,
                    scrambles: [formData.scramble1, formData.scramble2, formData.scramble3, formData.scramble4, formData.scramble5], // Legacy support
                    scrambleSet: scrambles // Better support
                })
            })

            if (response.ok) {
                const competition = await response.json()
                router.push(`/competition/${competition.id}`)
            } else {
                const error = await response.json()
                alert(error.error || 'Failed to create competition')
            }
        } catch (error) {
            console.error('Create error:', error)
            alert('Failed to create competition')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8">
            <div className="container mx-auto px-4 max-w-4xl">
                <Button
                    variant="ghost"
                    onClick={() => router.push('/admin')}
                    className="mb-6"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Dashboard
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl">Create Competition</CardTitle>
                        <CardDescription>
                            Set up a new speedcubing competition with full configuration
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-8">
                            {/* Basic Info */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium border-b pb-2">Basic Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Competition Name</Label>
                                        <Input id="name" name="name" value={formData.name} onChange={handleChange} placeholder="Weekly 3x3" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="slug">URL Slug</Label>
                                        <Input id="slug" name="slug" value={formData.slug} onChange={handleChange} placeholder="weekly-3x3" required />
                                    </div>
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium border-b pb-2">Schedule</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2 bg-blue-50 p-3 rounded-md">
                                        <Label className="text-blue-900 font-semibold">Competition Period (Solving Allowed)</Label>
                                        <div className="space-y-2 mt-2">
                                            <Label htmlFor="startDate" className="text-xs">Start Date & Time</Label>
                                            <Input type="datetime-local" id="startDate" name="startDate" value={formData.startDate} onChange={handleChange} required className="bg-white" />
                                        </div>
                                        <div className="space-y-2 mt-2">
                                            <Label htmlFor="endDate" className="text-xs">End Date & Time</Label>
                                            <Input type="datetime-local" id="endDate" name="endDate" value={formData.endDate} onChange={handleChange} required className="bg-white" />
                                        </div>
                                    </div>

                                    <div className="space-y-2 bg-green-50 p-3 rounded-md">
                                        <Label className="text-green-900 font-semibold">Registration Period (Signups Open)</Label>
                                        <div className="space-y-2 mt-2">
                                            <Label htmlFor="registrationStartDate" className="text-xs">Registration Opens</Label>
                                            <Input type="datetime-local" id="registrationStartDate" name="registrationStartDate" value={formData.registrationStartDate} onChange={handleChange} required className="bg-white" />
                                        </div>
                                        <div className="space-y-2 mt-2">
                                            <Label htmlFor="registrationEndDate" className="text-xs">Registration Closes</Label>
                                            <Input type="datetime-local" id="registrationEndDate" name="registrationEndDate" value={formData.registrationEndDate} onChange={handleChange} required className="bg-white" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Pricing */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium border-b pb-2">Pricing & Config</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Competition Type</Label>
                                            <RadioGroup
                                                value={formData.type}
                                                onValueChange={val => setFormData(prev => ({ ...prev, type: val }))}
                                                className="flex gap-4"
                                            >
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="FREE" id="type-free" />
                                                    <Label htmlFor="type-free">Free</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="PAID" id="type-paid" />
                                                    <Label htmlFor="type-paid">Paid</Label>
                                                </div>
                                            </RadioGroup>
                                        </div>

                                        {formData.type === 'PAID' && (
                                            <div className="space-y-2">
                                                <Label>Currency</Label>
                                                <Select value={formData.currency} onValueChange={val => setFormData(prev => ({ ...prev, currency: val }))}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Currency" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="INR">INR (₹)</SelectItem>
                                                        <SelectItem value="USD">USD ($)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="solveLimit">Solve Limit (AoX)</Label>
                                        <Input type="number" id="solveLimit" name="solveLimit" value={formData.solveLimit} onChange={handleChange} required min="1" max="100" />
                                    </div>
                                </div>

                                {formData.type === 'PAID' && (
                                    <div className="bg-gray-50 p-4 rounded-md space-y-4 mt-2 border">
                                        <div className="space-y-2">
                                            <Label>Pricing Model</Label>
                                            <RadioGroup
                                                value={formData.pricingModel}
                                                onValueChange={val => setFormData(prev => ({ ...prev, pricingModel: val }))}
                                                className="flex gap-4"
                                            >
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="flat" id="model-flat" />
                                                    <Label htmlFor="model-flat">Flat Fee</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="base_plus_extra" id="model-base" />
                                                    <Label htmlFor="model-base">Base + Per Event</Label>
                                                </div>
                                            </RadioGroup>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            {formData.pricingModel === 'flat' ? (
                                                <div className="space-y-2">
                                                    <Label htmlFor="flatPrice">Flat Fee Amount</Label>
                                                    <Input type="number" id="flatPrice" name="flatPrice" value={formData.flatPrice} onChange={handleChange} required min="0" />
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="basePrice">Base Fee (includes 1 event)</Label>
                                                        <Input type="number" id="basePrice" name="basePrice" value={formData.basePrice} onChange={handleChange} required min="0" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="perEventPrice">Fee per Extra Event</Label>
                                                        <Input type="number" id="perEventPrice" name="perEventPrice" value={formData.perEventPrice} onChange={handleChange} required min="0" />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Events & Scrambles */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium border-b pb-2">Events</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {WCA_EVENTS.map(event => (
                                        <div key={event.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={event.id}
                                                checked={formData.selectedEvents.includes(event.id)}
                                                onCheckedChange={() => handleEventToggle(event.id)}
                                            />
                                            <label htmlFor={event.id} className="text-sm cursor-pointer">{event.name}</label>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-4 mt-4">
                                    <Label className="text-base">Scrambles (For first selected event)</Label>
                                    <p className="text-sm text-gray-500 mb-2">Note: For multi-event competitions, use the main Admin Dashboard to configure all scrambles properly.</p>

                                    {[1, 2, 3, 4, 5].map(num => (
                                        <div key={num} className="space-y-2">
                                            <Label htmlFor={`scramble${num}`} className="text-xs text-gray-500">Scramble {num}</Label>
                                            <Textarea
                                                id={`scramble${num}`}
                                                name={`scramble${num}`}
                                                value={formData[`scramble${num}`]}
                                                onChange={handleChange}
                                                placeholder="R U R' U' F2 D B2 L2..."
                                                required={formData.selectedEvents.length > 0}
                                                rows={1}
                                                className="font-mono"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 text-lg"
                            >
                                {loading ? 'Creating...' : 'Create Competition'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export default CreateCompetition