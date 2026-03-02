'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Timer, ArrowLeft, Trophy, Play, ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

function CompetitionDetail() {
  const params = useParams()
  const router = useRouter()
  const [competition, setCompetition] = useState(null)
  const [myResult, setMyResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  
  useEffect(() => {
    if (params.slug) {
      fetchCompetition()
      fetchMyResult()
    }
  }, [params.slug])
  
  async function fetchCompetition() {
    try {
      const response = await fetch(`/api/competitions/${params.slug}`)
      if (response.ok) {
        const data = await response.json()
        setCompetition(data)
      }
    } catch (error) {
      console.error('Failed to fetch competition:', error)
    } finally {
      setLoading(false)
    }
  }
  
  async function fetchMyResult() {
    try {
      const response = await fetch(`/api/competitions/${params.slug}/my-result`, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setMyResult(data)
      }
    } catch (error) {
      console.error('Failed to fetch result:', error)
    }
  }
  
  async function handleStart() {
    if (!confirm('Once you start, you cannot restart. Are you ready?')) {
      return
    }
    
    setStarting(true)
    try {
      const response = await fetch(`/api/competitions/${competition.id}/start`, {
        method: 'POST',
        credentials: 'include'
      })
      
      if (response.ok) {
        const result = await response.json()
        router.push(`/solve/${result.id}`)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to start competition')
      }
    } catch (error) {
      console.error('Start error:', error)
      alert('Failed to start competition')
    } finally {
      setStarting(false)
    }
  }
  
  function handleContinue() {
    router.push(`/solve/${myResult.id}`)
  }
  
  function handleViewLeaderboard() {
    router.push(`/competitions/${params.slug}/leaderboard`)
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }
  
  if (!competition) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Competition not found</div>
      </div>
    )
  }
  
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  const canStart = new Date(competition.startDate) <= new Date() && 
                   new Date(competition.endDate) >= new Date()
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/')}
          className="mb-6 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Competitions
        </Button>
        
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-3xl text-white mb-2">{competition.name}</CardTitle>
                <CardDescription className="text-gray-400 text-lg">
                  {formatDate(competition.startDate)} - {formatDate(competition.endDate)}
                </CardDescription>
              </div>
              <Badge className={competition.status === 'running' ? 'bg-green-500' : 'bg-gray-500'}>
                {competition.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-3">Competition Format</h3>
              <div className="space-y-2 text-gray-300">
                <p>• 5 solves with official scrambles</p>
                <p>• 15-second inspection time (WCA rules)</p>
                <p>• +2 penalty for 15-17 seconds inspection</p>
                <p>• DNF for over 17 seconds inspection</p>
                <p>• Average of 5 (drop best and worst)</p>
              </div>
            </div>

            <div className="bg-orange-950/30 border border-orange-900/50 p-4 rounded-lg">
              <h4 className="flex items-center gap-2 font-semibold text-orange-400 mb-2">
                <ShieldCheck className="h-4 w-4" />
                Anti-Cheat & Integrity Policy
              </h4>
              <p className="text-sm text-gray-400">
                Opening developer tools, switching tabs, refreshing the page, or interacting with browser controls during a solve may result in your attempt being flagged for review.
              </p>
            </div>
            
            {!myResult && (
              <Alert className="bg-blue-900/30 border-blue-700">
                <AlertDescription className="text-blue-200">
                  ⚠️ Once you start, you cannot restart or redo solves. Make sure you&apos;re ready!
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex gap-4">
              {!myResult ? (
                <Button 
                  onClick={handleStart}
                  disabled={!canStart || starting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 px-8 text-lg"
                >
                  <Play className="h-5 w-5 mr-2" />
                  {starting ? 'Starting...' : 'Start Competition'}
                </Button>
              ) : myResult.status === 'completed' ? (
                <div className="space-y-2">
                  <Badge className="bg-green-600 text-lg px-4 py-2">✓ Completed</Badge>
                  <p className="text-gray-400">You&apos;ve completed all 5 solves!</p>
                </div>
              ) : (
                <Button 
                  onClick={handleContinue}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-6 px-8 text-lg"
                >
                  <Timer className="h-5 w-5 mr-2" />
                  Continue Solving ({myResult.attempt}/5)
                </Button>
              )}
              
              <Button 
                onClick={handleViewLeaderboard}
                variant="outline"
                className="border-gray-600 hover:bg-gray-700 py-6 px-8 text-lg"
              >
                <Trophy className="h-5 w-5 mr-2" />
                Leaderboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default CompetitionDetail
