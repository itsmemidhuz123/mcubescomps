import { PENALTY } from '../battleUtils';

export class ResultCalculator {
  static calculateAo5(solves) {
    if (!solves || solves.length === 0) return null;
    
    const validTimes = solves
      .filter(solve => solve.penalty !== PENALTY.DNF)
      .map(solve => solve.time + (solve.penalty === PENALTY.PLUS_TWO ? 2000 : 0));

    if (validTimes.length < 5) return null;

    const sorted = [...validTimes].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    
    const sum = trimmed.reduce((acc, val) => acc + val, 0);
    return sum / trimmed.length;
  }

  static calculateAverage(solves) {
    if (!solves || solves.length === 0) return null;
    
    const validTimes = solves
      .filter(solve => solve.penalty !== PENALTY.DNF)
      .map(solve => solve.time + (solve.penalty === PENALTY.PLUS_TWO ? 2000 : 0));

    if (validTimes.length === 0) return null;

    const sum = validTimes.reduce((acc, val) => acc + val, 0);
    return sum / validTimes.length;
  }

  static getBestSolve(solves) {
    if (!solves || solves.length === 0) return null;
    
    const validTimes = solves.filter(solve => solve.penalty !== PENALTY.DNF);
    if (validTimes.length === 0) return null;

    return validTimes.reduce((best, solve) => {
      const time = solve.time + (solve.penalty === PENALTY.PLUS_TWO ? 2000 : 0);
      const bestTime = best.time + (best.penalty === PENALTY.PLUS_TWO ? 2000 : 0);
      return time < bestTime ? solve : best;
    });
  }

  static getWorstSolve(solves) {
    if (!solves || solves.length === 0) return null;
    
    const validTimes = solves.filter(solve => solve.penalty !== PENALTY.DNF);
    if (validTimes.length === 0) return null;

    return validTimes.reduce((worst, solve) => {
      const time = solve.time + (solve.penalty === PENALTY.PLUS_TWO ? 2000 : 0);
      const worstTime = worst.time + (worst.penalty === PENALTY.PLUS_TWO ? 2000 : 0);
      return time > worstTime ? solve : worst;
    });
  }

  static compareResults(player1Solves, player2Solves) {
    const avg1 = this.calculateAo5(player1Solves);
    const avg2 = this.calculateAo5(player2Solves);

    if (avg1 === null && avg2 === null) return 'tie';
    if (avg1 === null) return 'player2';
    if (avg2 === null) return 'player1';

    return avg1 < avg2 ? 'player1' : avg1 > avg2 ? 'player2' : 'tie';
  }

  static formatTime(ms) {
    if (ms === null || ms === undefined) return '---';
    
    const totalSeconds = Math.floor(ms / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}.${centiseconds.toString().padStart(2, '0')}`;
  }

  static getSolveWithPenalty(solve) {
    if (!solve) return null;
    if (solve.penalty === PENALTY.DNF) return 'DNF';
    if (solve.penalty === PENALTY.PLUS_TWO) {
      return this.formatTime(solve.time + 2000) + '+';
    }
    return this.formatTime(solve.time);
  }
}
