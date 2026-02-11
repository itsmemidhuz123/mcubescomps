'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Timer, Eye, EyeOff } from 'lucide-react'

function SolvePage() {
  const params = useParams()
  const router = useRouter()
  const [result, setResult] = useState(null)
  const [competition, setCompetition] = useState(null)
  const [scrambles, setScrambles] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Timer states
  const [phase, setPhase] = useState('ready') // ready, inspection, solving, finished
  const [inspectionTime, setInspectionTime] = useState(15)
  const [solveTime, setSolveTime] = useState(0)
  const [scrambleVisible, setScrambleVisible] = useState(false)
  const [penalty, setPenalty] = useState('none')
  
  const inspectionTimerRef = useRef(null)
  const solveTimerRef = useRef(null)
  const solveStartTimeRef = useRef(null)
  
  useEffect(() => {
    if (params.resultId) {
      fetchData()
    }
    
    return () => {
      clearInterval(inspectionTimerRef.current)
      clearInterval(solveTimerRef.current)
    }
  }, [params.resultId])
  
  useEffect(() => {
    // Warn before page unload
    const handleBeforeUnload = (e) => {
      if (phase !== 'ready' && phase !== 'finished') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [phase])
  
  async function fetchData() {
    try {
      // Fetch result
      const resultRes = await fetch(`/api/results/${params.resultId}`, {
        credentials: 'include'
      })
      
      if (!resultRes.ok) {
        router.push('/')
        return
      }
      
      const resultData = await resultRes.json()
      setResult(resultData)
      
      // Fetch competition with scrambles
      const compRes = await fetch(`/api/competitions/${resultData.competitionId}`)
      const compData = await compRes.json()
      setCompetition(compData)
      setScrambles(compData.scrambles || [])
      
    } catch (error) {
      console.error('Failed to fetch data:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }
  
  function startInspection() {
    setScrambleVisible(true)
    setPhase('inspection')
    setInspectionTime(15)
    setPenalty('none')
    
    inspectionTimerRef.current = setInterval(() => {
      setInspectionTime(prev => {
        const newTime = prev - 0.01
        
        if (newTime <= 0) {
          // Over 17 seconds = DNF
          clearInterval(inspectionTimerRef.current)
          setPenalty('DNF')
          return 0
        } else if (newTime <= -2) {
          // Already DNF
          return newTime
        } else if (newTime < 0) {
          // 15-17 seconds = +2
          if (penalty === 'none') {
            setPenalty('+2')
          }
          return newTime
        }
        
        return newTime
      })
    }, 10)
  }
  
  function startSolve() {
    if (phase !== 'inspection') return
    
    clearInterval(inspectionTimerRef.current)
    
    // Check if DNF (over 17 seconds)
    if (inspectionTime < -2) {
      setPenalty('DNF')
      submitTime(0, 'DNF')
      return
    }
    
    setPhase('solving')
    setSolveTime(0)
    solveStartTimeRef.current = Date.now()
    
    solveTimerRef.current = setInterval(() => {
      setSolveTime(Date.now() - solveStartTimeRef.current)
    }, 10)
  }
  
  function stopSolve() {
    if (phase !== 'solving') return
    
    clearInterval(solveTimerRef.current)
    const finalTime = Date.now() - solveStartTimeRef.current
    setSolveTime(finalTime)
    setPhase('finished')
    
    // Auto-submit after a brief moment
    setTimeout(() => {
      submitTime(finalTime, penalty)
    }, 500)
  }
  
  async function submitTime(time, appliedPenalty) {
    try {
      const response = await fetch(`/api/results/${params.resultId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ time, penalty: appliedPenalty })
      })
      
      if (response.ok) {
        const updated = await response.json()
        setResult(updated)
        
        // Check if all solves completed
        if (updated.attempt >= 5) {
          setTimeout(() => {
            router.push(`/competitions/${competition.slug}/leaderboard`)
          }, 2000)
        } else {
          // Reset for next solve
          setTimeout(() => {
            setPhase('ready')
            setScrambleVisible(false)
            setInspectionTime(15)
            setSolveTime(0)
            setPenalty('none')
          }, 1500)
        }
      }
    } catch (error) {
      console.error('Failed to submit time:', error)
      alert('Failed to submit time. Please try again.')
    }
  }
  
  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000)
    const centiseconds = Math.floor((ms % 1000) / 10)
    return `${seconds}.${centiseconds.toString().padStart(2, '0')}`
  }
  
  const formatInspection = (seconds) => {
    if (seconds < 0) {
      return `+${Math.abs(seconds).toFixed(2)}`
    }
    return seconds.toFixed(2)
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }
  
  if (!result || !competition) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Result not found</div>
      </div>
    )
  }
  
  const currentAttempt = result.attempt
  const currentScramble = scrambles.find(s => s.scrambleNumber === currentAttempt + 1)
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-800/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{competition.name}</h1>
              <p className="text-gray-400">Solve {currentAttempt + 1} of 5</p>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Badge 
                  key={i} 
                  className={i <= currentAttempt ? 'bg-green-600' : 'bg-gray-600'}
                >
                  {i}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl space-y-6">
          {/* Scramble */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Scramble</CardTitle>
                {phase === 'ready' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setScrambleVisible(!scrambleVisible)}
                  >
                    {scrambleVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {scrambleVisible ? (
                <p className="text-2xl font-mono text-center text-blue-400">
                  {currentScramble?.scrambleText}
                </p>
              ) : (
                <p className="text-gray-500 text-center">Hidden - Start inspection to view</p>
              )}
            </CardContent>
          </Card>
          
          {/* Timer */}
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="py-12">
              <div className="text-center space-y-6">
                {phase === 'ready' && (
                  <>
                    <Timer className="h-20 w-20 mx-auto text-blue-500" />
                    <div className="text-6xl font-bold">Ready</div>
                    <Button
                      onClick={startInspection}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-8 px-12 text-2xl"
                    >
                      Start Inspection
                    </Button>
                  </>
                )}
                
                {phase === 'inspection' && (
                  <>
                    <div className={`text-8xl font-bold ${
                      inspectionTime < 0 ? 'text-red-500' : 
                      inspectionTime < 3 ? 'text-yellow-500' : 
                      'text-blue-500'
                    }`}>
                      {formatInspection(inspectionTime)}
                    </div>
                    {penalty !== 'none' && (
                      <Badge className="text-2xl px-6 py-2" variant="destructive">
                        {penalty}
                      </Badge>
                    )}
                    <Button
                      onClick={startSolve}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold py-8 px-12 text-2xl"
                    >
                      Start Solve
                    </Button>
                  </>
                )}
                
                {phase === 'solving' && (
                  <>
                    <div className="text-9xl font-bold text-green-500">
                      {formatTime(solveTime)}
                    </div>
                    <Button
                      onClick={stopSolve}
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold py-8 px-12 text-2xl"
                    >
                      Stop
                    </Button>
                  </>
                )}
                
                {phase === 'finished' && (
                  <>
                    <div className="text-8xl font-bold text-white">
                      {formatTime(solveTime)}
                    </div>
                    {penalty !== 'none' && (
                      <Badge className="text-2xl px-6 py-2" variant="destructive">
                        {penalty}
                      </Badge>
                    )}
                    <div className="text-gray-400 text-xl">Submitting...</div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Instructions */}
          {phase === 'ready' && (
            <Alert className="bg-gray-800 border-gray-700">
              <AlertDescription className="text-gray-300">
                ℹ️ Click "Start Inspection" to begin. You have 15 seconds to inspect the cube.
                +2 penalty for 15-17 seconds. DNF for over 17 seconds.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  )
}

export default SolvePage
