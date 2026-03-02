import { TournamentStatus, getRoundStatus as getTournamentRoundStatus } from './tournament';

export function getUserPosition(userId, leaderboard) {
  if (!leaderboard || !Array.isArray(leaderboard) || !userId) return -1;
  
  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    const aTime = a.average ?? a.bestSingle ?? Infinity;
    const bTime = b.average ?? b.bestSingle ?? Infinity;
    return aTime - bTime;
  });
  
  const position = sortedLeaderboard.findIndex(entry => entry.userId === userId);
  return position === -1 ? -1 : position + 1;
}

export function isQualified(userPosition, advancementCount) {
  if (userPosition <= 0 || userPosition === -1) return false;
  return userPosition <= advancementCount;
}

export function getCurrentRound(competition, eventId) {
  if (!competition) return null;
  
  // Check for per-event rounds first (admin can configure rounds per event)
  if (eventId && competition.eventRounds && competition.eventRounds[eventId]) {
    const eventRounds = competition.eventRounds[eventId];
    const currentRoundNum = competition.eventCurrentRound?.[eventId] || 1;
    return eventRounds.find(r => r.roundNumber === currentRoundNum) || null;
  }
  
  // Fallback to shared rounds
  if (!competition.rounds || !Array.isArray(competition.rounds)) {
    return null;
  }
  
  const currentRoundNum = competition.currentRound || 1;
  return competition.rounds.find(r => r.roundNumber === currentRoundNum) || null;
}

export function getNextRound(competition, eventId) {
  if (!competition) return null;
  
  // Check for per-event rounds first
  if (eventId && competition.eventRounds && competition.eventRounds[eventId]) {
    const eventRounds = competition.eventRounds[eventId];
    const currentRoundNum = competition.eventCurrentRound?.[eventId] || 1;
    return eventRounds.find(r => r.roundNumber === currentRoundNum + 1) || null;
  }
  
  // Fallback to shared rounds
  if (!competition.rounds || !Array.isArray(competition.rounds)) {
    return null;
  }
  
  const currentRoundNum = competition.currentRound || 1;
  return competition.rounds.find(r => r.roundNumber === currentRoundNum + 1) || null;
}

export function getRoundStatus(round, competition) {
  if (!round || !competition) return 'unknown';
  
  if (round.status === 'live') {
    return 'live';
  }
  
  if (round.status === 'completed') {
    return 'completed';
  }
  
  if (round.status === 'upcoming') {
    return 'upcoming';
  }
  
  return getTournamentRoundStatus(round, competition);
}

export function formatRoundDate(dateString) {
  if (!dateString) return 'Not scheduled';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getUserEventStatus(competition, eventId, registration, leaderboard) {
  if (!competition || !registration) {
    return { status: 'unknown', label: 'Unknown' };
  }

  const currentRound = getCurrentRound(competition, eventId);
  if (!currentRound) {
    return { status: 'not_started', label: 'Not Started' };
  }

  const roundStatus = getRoundStatus(currentRound, competition);

  if (roundStatus === 'live') {
    return { status: 'in_progress', label: 'In Progress' };
  }

  if (roundStatus === 'completed' || roundStatus === 'verification' || roundStatus === 'advancing') {
    if (!leaderboard || leaderboard.length === 0) {
      return { status: 'completed', label: 'Completed' };
    }

    const userId = registration.userId;
    const userPosition = getUserPosition(userId, leaderboard);
    const advancementCount = currentRound.qualifyValue || 50;

    if (userPosition === -1) {
      return { status: 'not_started', label: 'Not Started' };
    }

    if (isQualified(userPosition, advancementCount)) {
      const nextRound = getNextRound(competition, eventId);
      if (nextRound) {
        const nextRoundStatus = getRoundStatus(nextRound, competition);
        if (nextRoundStatus === 'live') {
          return { status: 'qualified', label: 'Qualified - Next Round Live' };
        }
        return { status: 'qualified', label: 'Qualified' };
      }
      return { status: 'qualified', label: 'Qualified' };
    }

    return { status: 'eliminated', label: 'Eliminated' };
  }

  if (roundStatus === 'upcoming' || roundStatus === 'waiting') {
    return { status: 'not_started', label: 'Not Started' };
  }

  return { status: 'unknown', label: 'Unknown' };
}

export function getRegisteredEvents(registration) {
  if (!registration) return [];
  return registration.events || registration.registeredEvents || [];
}

export function filterRegisteredEvents(competitionEvents, registeredEvents) {
  if (!competitionEvents || !registeredEvents) return [];
  return competitionEvents.filter(eventId => registeredEvents.includes(eventId));
}

export function getEventRounds(competition, eventId) {
  if (!competition || !eventId) return [];
  return competition.eventRounds?.[eventId] || [];
}

export function getEventCurrentRoundNumber(competition, eventId) {
  if (!competition || !eventId) return 1;
  return competition.eventCurrentRound?.[eventId] || 1;
}

export function setEventCurrentRound(competition, eventId, roundNumber) {
  if (!competition || !eventId) return competition;
  return {
    ...competition,
    eventCurrentRound: {
      ...competition.eventCurrentRound,
      [eventId]: roundNumber
    }
  };
}

export function hasPerEventRounds(competition) {
  if (!competition) return false;
  return !!competition.eventRounds && Object.keys(competition.eventRounds).length > 0;
}

export function getAllEventsWithRounds(competition) {
  if (!competition || !competition.eventRounds) return [];
  return Object.keys(competition.eventRounds);
}
