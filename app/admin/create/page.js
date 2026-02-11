'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft } from 'lucide-react'

function CreateCompetition() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    startDate: '',
    endDate: '',
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
  
  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    
    try {
      const scrambles = [
        formData.scramble1,
        formData.scramble2,
        formData.scramble3,
        formData.scramble4,
        formData.scramble5
      ]
      
      const response = await fetch('/api/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          startDate: formData.startDate,
          endDate: formData.endDate,
          scrambles
        })
      })
      
      if (response.ok) {
        const competition = await response.json()
        router.push(`/competitions/${competition.slug}`)
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/')}
          className="mb-6 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-3xl text-white">Create Competition</CardTitle>
            <CardDescription className="text-gray-400">
              Set up a new speedcubing competition
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">Competition Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Weekly 3x3 Competition"
                  required
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="slug" className="text-white">URL Slug</Label>
                <Input
                  id="slug"
                  name="slug"
                  value={formData.slug}
                  onChange={handleChange}
                  placeholder="weekly-3x3-competition"
                  required
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="text-white">Start Date & Time</Label>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={handleChange}
                    required
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="endDate" className="text-white">End Date & Time</Label>
                  <Input
                    id="endDate"
                    name="endDate"
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={handleChange}
                    required
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <Label className="text-white text-lg">Official Scrambles (5 required)</Label>
                
                {[1, 2, 3, 4, 5].map(num => (
                  <div key={num} className="space-y-2">
                    <Label htmlFor={`scramble${num}`} className="text-gray-400">Scramble {num}</Label>
                    <Textarea
                      id={`scramble${num}`}
                      name={`scramble${num}`}
                      value={formData[`scramble${num}`]}
                      onChange={handleChange}
                      placeholder="R U R' U' F2 D B2 L2..."
                      required
                      rows={2}
                      className="bg-gray-700 border-gray-600 text-white font-mono"
                    />
                  </div>
                ))}
              </div>
              
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 text-lg"
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
