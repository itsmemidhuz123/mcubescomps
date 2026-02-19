export const TournamentStatus = {
    REGISTRATION: 'registration',
    ROUND_LIVE: 'round_live',
    VERIFICATION: 'verification',
    ADVANCING: 'advancing',
    COMPLETED: 'completed'
};

export const QualifyType = {
    PERCENTAGE: 'percentage',
    FIXED: 'fixed'
};

export const CompetitionMode = {
    STANDARD: 'standard',
    TOURNAMENT: 'tournament'
};

export function getDefaultRound(roundNumber, isFinal = false) {
    return {
        roundNumber,
        name: isFinal ? 'Final' : `Round ${roundNumber}`,
        qualifyType: QualifyType.PERCENTAGE,
        qualifyValue: isFinal ? 3 : 50,
        requireVerification: true,
        scheduledDate: null,
        isFinal
    };
}

export function getDefaultTournamentSettings() {
    return {
        mode: CompetitionMode.STANDARD,
        rounds: [getDefaultRound(1, false)],
        currentRound: 1,
        tournamentStatus: TournamentStatus.REGISTRATION,
        winners: []
    };
}

export function calculateQualifiedCount(totalParticipants, qualifyType, qualifyValue) {
    if (qualifyType === QualifyType.PERCENTAGE) {
        return Math.max(1, Math.floor(totalParticipants * (qualifyValue / 100)));
    }
    return Math.min(qualifyValue, totalParticipants);
}

export function getRoundStatus(round, competition) {
    if (!competition) return 'unknown';

    const now = new Date();
    const scheduledDate = round.scheduledDate ? new Date(round.scheduledDate) : null;
    const currentRound = competition.currentRound || 1;

    if (round.roundNumber < currentRound) {
        return 'completed';
    }

    if (round.roundNumber > currentRound) {
        if (scheduledDate && now < scheduledDate) {
            return 'upcoming';
        }
        return 'locked';
    }

    if (scheduledDate && now < scheduledDate) {
        return 'waiting';
    }

    const tournamentStatus = competition.tournamentStatus || TournamentStatus.ROUND_LIVE;

    if (tournamentStatus === TournamentStatus.VERIFICATION) {
        return 'verification';
    }

    if (tournamentStatus === TournamentStatus.ADVANCING) {
        return 'advancing';
    }

    if (tournamentStatus === TournamentStatus.COMPLETED) {
        return 'completed';
    }

    return 'live';
}

export function canUserCompeteInRound(userParticipant, roundNumber, competition) {
    if (!userParticipant) return false;
    if (userParticipant.eliminated) return false;
    if (userParticipant.currentRound < roundNumber) return false;

    const roundStatus = getRoundStatus(
        competition.rounds?.find(r => r.roundNumber === roundNumber) || { roundNumber },
        competition
    );

    return roundStatus === 'live';
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

export function getRoundStatusLabel(status) {
    const labels = {
        'unknown': 'Unknown',
        'completed': 'Completed',
        'upcoming': 'Upcoming',
        'locked': 'Locked',
        'waiting': 'Waiting',
        'verification': 'Verification',
        'advancing': 'Advancing',
        'live': 'Live'
    };
    return labels[status] || status;
}

export function getRoundStatusColor(status) {
    const colors = {
        'unknown': 'bg-gray-100 text-gray-600',
        'completed': 'bg-green-100 text-green-700',
        'upcoming': 'bg-blue-100 text-blue-700',
        'locked': 'bg-gray-100 text-gray-500',
        'waiting': 'bg-yellow-100 text-yellow-700',
        'verification': 'bg-orange-100 text-orange-700',
        'advancing': 'bg-purple-100 text-purple-700',
        'live': 'bg-green-100 text-green-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
}