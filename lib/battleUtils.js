// Battle states
export const BATTLE_STATES = {
  WAITING: 'waiting',
  COUNTDOWN: 'countdown',
  LIVE: 'live',
  COMPLETED: 'completed',
};

// Battle formats
export const BATTLE_FORMATS = {
  AO5: 'ao5',
  FIRST_TO_3: 'firstTo3',
  FIRST_TO_5: 'firstTo5',
  SINGLE: 'single',
};

// Penalty values
export const PENALTY = {
  NONE: 0,
  PLUS_TWO: 2,
  DNF: -1,
};

// Timing constants
export const COUNTDOWN_SECONDS = 5;
export const MAX_SOLVE_TIME_MS = 180000;
export const INSPECTION_TIME_MS = 15000;
export const MATCHMAKING_TIMEOUT_MS = 60000;
