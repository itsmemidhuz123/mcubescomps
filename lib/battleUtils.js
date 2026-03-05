export const BATTLE_STATES = {
  WAITING: 'waiting',
  COUNTDOWN: 'countdown',
  LIVE: 'live',
  COMPLETED: 'completed',
};

export const PENALTY = {
  NONE: 0,
  PLUS_TWO: 2,
  DNF: -1,
};

export const BATTLE_FORMATS = {
  AO5: 'ao5',
  FIRST_TO_3: 'firstTo3',
  FIRST_TO_5: 'firstTo5',
  SINGLE: 'single',
};

export const BATTLE_FORMAT_INFO = {
  [BATTLE_FORMATS.AO5]: { name: 'Ao5', winsRequired: null, description: 'Best of 5 average' },
  [BATTLE_FORMATS.FIRST_TO_3]: { name: 'First to 3', winsRequired: 3, description: 'First to win 3 scrambles' },
  [BATTLE_FORMATS.FIRST_TO_5]: { name: 'First to 5', winsRequired: 5, description: 'First to win 5 scrambles' },
  [BATTLE_FORMATS.SINGLE]: { name: 'Single', winsRequired: null, description: 'Single solve' },
};

export const COUNTDOWN_SECONDS = 5;
export const MAX_SOLVE_TIME_MS = 180000;
export const INSPECTION_TIME_MS = 15000;

export function calculateAo5(solves) {
  if (!solves || !Array.isArray(solves) || solves.length < 5) return null;

  const times = solves.map(s => {
    if (s.penalty === PENALTY.DNF) return Infinity;
    const t = s.time;
    if (typeof t !== 'number' || !isFinite(t)) return Infinity;
    return t + (s.penalty * 1000);
  });

  const sorted = [...times].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);
  
  const validTimes = trimmed.filter(t => t !== Infinity);
  if (validTimes.length < 3) return null;
  
  return validTimes.reduce((a, b) => a + b, 0) / 3;
}

export function calculateBestSingle(solves) {
  if (!solves || !Array.isArray(solves) || solves.length === 0) return null;
  
  const times = solves
    .filter(s => s.penalty !== PENALTY.DNF)
    .map(s => {
      const t = s.time;
      if (typeof t !== 'number' || !isFinite(t)) return null;
      return t + (s.penalty * 1000);
    })
    .filter(t => t !== null);
  
  if (times.length === 0) return null;
  return Math.min(...times);
}

export function formatBattleTime(ms) {
  if (ms === null || ms === undefined || ms === Infinity) return 'DNF';
  
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  }
  return `${seconds}.${centiseconds.toString().padStart(2, '0')}`;
}

export function determineWinner(player1Solves, player2Solves) {
  const ao5_1 = calculateAo5(player1Solves);
  const ao5_2 = calculateAo5(player2Solves);
  
  if (ao5_1 === null && ao5_2 === null) return null;
  if (ao5_1 === null) return 'player2';
  if (ao5_2 === null) return 'player1';
  
  if (ao5_1 < ao5_2) return 'player1';
  if (ao5_2 < ao5_1) return 'player2';
  
  const best1 = calculateBestSingle(player1Solves);
  const best2 = calculateBestSingle(player2Solves);
  
  if (best1 !== null && best2 !== null && best1 < best2) return 'player1';
  if (best2 !== null && best1 !== null && best2 < best1) return 'player2';
  
  const dnf1 = player1Solves.filter(s => s.penalty === PENALTY.DNF).length;
  const dnf2 = player2Solves.filter(s => s.penalty === PENALTY.DNF).length;
  
  if (dnf1 < dnf2) return 'player1';
  if (dnf2 < dnf1) return 'player2';
  
  return 'tie';
}

export function getPlayerNumber(uid, battle) {
  if (battle.player1 === uid) return 1;
  if (battle.player2 === uid) return 2;
  return null;
}

export function getOpponentUid(uid, battle) {
  if (battle.player1 === uid) return battle.player2;
  if (battle.player2 === uid) return battle.player1;
  return null;
}

export const BATTLE_EVENTS = [
  { id: '333', name: '3x3', icon: '⬜' },
  { id: '222', name: '2x2', icon: '⬛' },
  { id: '444', name: '4x4', icon: '🟦' },
  { id: '555', name: '5x5', icon: '🟪' },
  { id: 'pyram', name: 'Pyraminx', icon: '🔺' },
  { id: 'skewb', name: 'Skewb', icon: '🔷' },
  { id: 'sq1', name: 'Square-1', icon: '🟧' },
];

export const BATTLE_TYPES = {
  ROOM: 'room',
  MATCHMAKING: 'matchmaking',
};

export const TEAM_SIZES = [
  { id: 1, name: '1v1', playersPerTeam: 1 },
  { id: 2, name: '2v2', playersPerTeam: 2 },
  { id: 4, name: '4v4', playersPerTeam: 4 },
  { id: 8, name: '8v8', playersPerTeam: 8 },
];

export const MATCHMAKING_TIMEOUT_MS = 60000; // 1 minute

export const TOTAL_SCRAMBLES = 5;

export function getScrambleWinner(solve1, solve2) {
  if (!solve1 || !solve2) return null;
  
  const time1 = solve1.penalty === PENALTY.DNF ? Infinity : solve1.time + (solve1.penalty * 1000);
  const time2 = solve2.penalty === PENALTY.DNF ? Infinity : solve2.time + (solve2.penalty * 1000);
  
  if (time1 === Infinity && time2 === Infinity) return 'tie';
  if (time1 === Infinity) return 'player2';
  if (time2 === Infinity) return 'player1';
  if (time1 < time2) return 'player1';
  if (time2 < time1) return 'player2';
  return 'tie';
}

export function calculateBattleScore(p1Solves, p2Solves, format, winsRequired) {
  const scores = { player1: 0, player2: 0 };
  const maxScrambles = Math.min(p1Solves.length, p2Solves.length);
  
  for (let i = 0; i < maxScrambles; i++) {
    const winner = getScrambleWinner(p1Solves[i], p2Solves[i]);
    if (winner === 'player1') scores.player1++;
    else if (winner === 'player2') scores.player2++;
  }
  
  if (format === BATTLE_FORMATS.AO5 || format === BATTLE_FORMATS.SINGLE) {
    return { ...scores, determined: false };
  }
  
  const determined = scores.player1 >= winsRequired || scores.player2 >= winsRequired;
  return { ...scores, determined };
}

export function determineBattleWinner(p1Solves, p2Solves, format, winsRequired, roundCount) {
  if (format === BATTLE_FORMATS.AO5 || format === BATTLE_FORMATS.SINGLE) {
    const ao5_1 = calculateAo5(p1Solves);
    const ao5_2 = calculateAo5(p2Solves);
    
    if (format === BATTLE_FORMATS.SINGLE) {
      const best1 = calculateBestSingle(p1Solves);
      const best2 = calculateBestSingle(p2Solves);
      
      if (best1 === null && best2 === null) return null;
      if (best1 === null) return 'player2';
      if (best2 === null) return 'player1';
      return best1 < best2 ? 'player1' : 'player2';
    }
    
    if (ao5_1 === null && ao5_2 === null) return null;
    if (ao5_1 === null) return 'player2';
    if (ao5_2 === null) return 'player1';
    
    if (ao5_1 < ao5_2) return 'player1';
    if (ao5_2 < ao5_1) return 'player2';
    
    const best1 = calculateBestSingle(p1Solves);
    const best2 = calculateBestSingle(p2Solves);
    
    if (best1 !== null && best2 !== null && best1 < best2) return 'player1';
    if (best2 !== null && best1 !== null && best2 < best1) return 'player2';
    
    const dnf1 = p1Solves.filter(s => s.penalty === PENALTY.DNF).length;
    const dnf2 = p2Solves.filter(s => s.penalty === PENALTY.DNF).length;
    
    if (dnf1 < dnf2) return 'player1';
    if (dnf2 < dnf1) return 'player2';
    
    return 'tie';
  }
  
  const scores = calculateBattleScore(p1Solves, p2Solves, format, winsRequired);
  
  if (scores.player1 > scores.player2) return 'player1';
  if (scores.player2 > scores.player1) return 'player2';
  return 'tie';
}

export const ELO_K_FACTOR = 32;
export const ELO_DEFAULT_RATING = 1000;

export function calculateExpectedScore(rating1, rating2) {
  return 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
}

export function calculateNewElo(winnerRating, loserRating, isDraw = false) {
  const expectedWinner = calculateExpectedScore(winnerRating, loserRating);
  const expectedLoser = calculateExpectedScore(loserRating, winnerRating);
  
  let winnerScore = isDraw ? 0.5 : 1;
  let loserScore = isDraw ? 0.5 : 0;
  
  const newWinnerRating = Math.round(winnerRating + ELO_K_FACTOR * (winnerScore - expectedWinner));
  const newLoserRating = Math.round(loserRating + ELO_K_FACTOR * (loserScore - expectedLoser));
  
  return {
    winnerNewRating: Math.max(100, newWinnerRating),
    loserNewRating: Math.max(100, newLoserRating),
  };
}

export function calculateBattleEloChanges(player1Rating, player2Rating, winner) {
  if (winner === 'tie') {
    const { winnerNewRating, loserNewRating } = calculateNewElo(player1Rating, player2Rating, true);
    return {
      player1Change: winnerNewRating - player1Rating,
      player2Change: loserNewRating - player2Rating,
    };
  }
  
  if (winner === 'player1') {
    const { winnerNewRating, loserNewRating } = calculateNewElo(player1Rating, player2Rating);
    return {
      player1Change: winnerNewRating - player1Rating,
      player2Change: loserNewRating - player2Rating,
    };
  }
  
  if (winner === 'player2') {
    const { winnerNewRating, loserNewRating } = calculateNewElo(player2Rating, player1Rating);
    return {
      player1Change: loserNewRating - player1Rating,
      player2Change: winnerNewRating - player2Rating,
    };
  }
  
  return { player1Change: 0, player2Change: 0 };
}
