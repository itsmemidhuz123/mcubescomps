'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Trophy, Medal } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function Leaderboard() {
  const params = useParams()
  const router = useRouter()
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (params.slug) {
      fetchLeaderboard()
    }
  }, [params.slug])
  
  async function fetchLeaderboard() {
    try {
      const response = await fetch(`/api/competitions/${params.slug}/leaderboard`)
      if (response.ok) {
        const data = await response.json()
        setLeaderboard(data)
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const formatTime = (ms) => {
    if (ms === null || ms === undefined) return '-'
    const seconds = (ms / 1000).toFixed(2)
    return `${seconds}s`
  }
  
  const getRankBadge = (index) => {
    if (index === 0) return <Medal className="h-5 w-5 text-yellow-500" />
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />
    if (index === 2) return <Medal className="h-5 w-5 text-orange-600" />
    return <span className="text-gray-400">{index + 1}</span>
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <div className="container mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          onClick={() => router.push(`/competitions/${params.slug}`)}
          className="mb-6 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Competition
        </Button>
        
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <CardTitle className="text-3xl text-white">Leaderboard</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading leaderboard...</div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                No completed results yet. Be the first to compete!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700 hover:bg-gray-700/50">
                      <TableHead className="text-gray-300">Rank</TableHead>
                      <TableHead className="text-gray-300">User</TableHead>
                      <TableHead className="text-gray-300 text-center">Solve 1</TableHead>
                      <TableHead className="text-gray-300 text-center">Solve 2</TableHead>
                      <TableHead className="text-gray-300 text-center">Solve 3</TableHead>
                      <TableHead className="text-gray-300 text-center">Solve 4</TableHead>
                      <TableHead className="text-gray-300 text-center">Solve 5</TableHead>
                      <TableHead className="text-gray-300 text-right font-bold">Average</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((entry, index) => (
                      <TableRow key={entry.userId} className="border-gray-700 hover:bg-gray-700/50">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getRankBadge(index)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {entry.userPicture && (
                              <img src={entry.userPicture} alt={entry.userName} className="h-8 w-8 rounded-full" />
                            )}
                            <span className="font-medium">{entry.userName}</span>
                          </div>
                        </TableCell>
                        {entry.times.map((time, i) => (
                          <TableCell key={i} className="text-center">
                            <div>
                              {formatTime(time)}
                              {entry.penalties[i] && entry.penalties[i] !== 'none' && (
                                <Badge className="ml-1 text-xs" variant="destructive">
                                  {entry.penalties[i]}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-bold text-lg">
                          {entry.isDNF ? (
                            <Badge variant="destructive">DNF</Badge>
                          ) : (
                            <span className="text-green-400">{formatTime(entry.average)}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Leaderboard
