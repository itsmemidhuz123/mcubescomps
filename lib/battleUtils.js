export const BATTLE_STATES = {
  WAITING: 'waiting',
  LIVE: 'live',
  COMPLETED: 'completed',
};

export const PENALTY = {
  NONE: 0,
  PLUS_TWO: 2,
  DNF: -1,
};

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
];

export const TOTAL_SCRAMBLES = 5;
export const INSPECTION_TIME_MS = 15000;
export const MAX_SOLVE_TIME_MS = 600000;
