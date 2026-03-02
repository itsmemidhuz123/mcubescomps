"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Trophy, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  ArrowRight,
  Eye,
  Play
} from 'lucide-react';
import { 
  getCurrentRound, 
  getNextRound, 
  getRoundStatus, 
  getUserPosition, 
  isQualified,
  formatRoundDate 
} from '@/lib/competitionLogic';
import { getEventName } from '@/lib/wcaEvents';
import Link from 'next/link';

export default function RoundStatus({
  competition,
  eventId,
  userId,
  leaderboard,
  onProceedToNextRound,
  showSubmitButton = false,
  onStartCompetition
}) {
  const currentRound = getCurrentRound(competition, eventId);
  const nextRound = getNextRound(competition, eventId);
  
  if (!currentRound) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="py-6">
          <div className="text-center text-gray-400">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
            <p>No rounds configured for this competition.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const roundStatus = getRoundStatus(currentRound, competition);
  const advancementCount = currentRound.qualifyValue || 50;
  
  let userPosition = -1;
  let qualified = false;
  
  if (leaderboard && leaderboard.length > 0 && userId) {
    userPosition = getUserPosition(userId, leaderboard);
    qualified = isQualified(userPosition, advancementCount);
  }

  if (roundStatus === 'live') {
    if (showSubmitButton) {
      return null;
    }
    return (
      <Card className="bg-blue-900/20 border-blue-700">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-blue-400 font-medium">Round {currentRound.roundNumber} is Live</span>
            </div>
            {onStartCompetition && (
              <Button onClick={onStartCompetition} className="bg-blue-600 hover:bg-blue-700">
                <Play className="h-4 w-4 mr-2" />
                Start Solving
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (roundStatus === 'waiting' || roundStatus === 'upcoming') {
    const scheduledDate = currentRound.scheduledDate;
    
    return (
      <Card className="bg-yellow-900/20 border-yellow-700">
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-400" />
              <div>
                <span className="text-yellow-400 font-medium">Round {currentRound.roundNumber} Starting Soon</span>
                {scheduledDate && (
                  <p className="text-sm text-yellow-300/70">
                    Scheduled: {formatRoundDate(scheduledDate)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (roundStatus === 'completed' || roundStatus === 'verification' || roundStatus === 'advancing') {
    if (!leaderboard || leaderboard.length === 0 || userPosition === -1) {
      return (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-green-400 font-medium">
                  Round {currentRound.roundNumber} Completed
                </span>
              </div>
              <Link href={`/leaderboard/${competition.id}`}>
                <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                  <Eye className="h-4 w-4 mr-2" />
                  View Leaderboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (qualified) {
      if (nextRound) {
        const nextRoundStatus = getRoundStatus(nextRound, competition);
        const isNextLive = nextRoundStatus === 'live';
        const isNextUpcoming = nextRoundStatus === 'upcoming' || nextRoundStatus === 'waiting';
        
        return (
          <Card className="bg-green-900/20 border-green-700">
            <CardContent className="py-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-400" />
                    <span className="text-green-400 font-medium">
                      You Qualified for Round {currentRound.roundNumber}!
                    </span>
                  </div>
                  <Badge className="bg-green-600">
                    Rank #{userPosition} / {advancementCount} spots
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-green-800">
                  {isNextLive ? (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-green-300">Next round is live!</span>
                      </div>
                      {onProceedToNextRound && (
                        <Button 
                          onClick={onProceedToNextRound} 
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Proceed to Next Round
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                    </>
                  ) : isNextUpcoming ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-yellow-400" />
                        <span className="text-yellow-300">
                          Next round starts: {formatRoundDate(nextRound.scheduledDate)}
                        </span>
                      </div>
                      <Button disabled className="bg-gray-600 cursor-not-allowed">
                        Proceed to Next Round
                        <Clock className="h-4 w-4 ml-2" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-400">
                        Round {nextRound.roundNumber} status: {nextRoundStatus}
                      </span>
                      {onProceedToNextRound && (
                        <Button 
                          onClick={onProceedToNextRound} 
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Proceed to Next Round
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      }

      return (
        <Card className="bg-green-900/20 border-green-700">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-400" />
                <div>
                  <span className="text-green-400 font-medium">
                    Congratulations! You Qualified!
                  </span>
                  <p className="text-sm text-green-300/70">
                    Rank #{userPosition} in Round {currentRound.roundNumber}
                  </p>
                </div>
              </div>
              <Link href={`/leaderboard/${competition.id}`}>
                <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                  <Eye className="h-4 w-4 mr-2" />
                  View Leaderboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="bg-red-900/20 border-red-700">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-400" />
              <div>
                <span className="text-red-400 font-medium">
                  You Did Not Qualify
                </span>
                <p className="text-sm text-red-300/70">
                  Rank #{userPosition} - Top {advancementCount} qualified
                </p>
              </div>
            </div>
            <Link href={`/leaderboard/${competition.id}`}>
              <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                <Eye className="h-4 w-4 mr-2" />
                View Leaderboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="py-4">
        <div className="text-center text-gray-400">
          <p>Round {currentRound.roundNumber} - Status: {roundStatus}</p>
        </div>
      </CardContent>
    </Card>
  );
}
