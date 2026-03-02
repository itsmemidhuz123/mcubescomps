const DNF_TIME = Infinity;

export const formatTime = (ms, penalty = 'none') => {
    if (penalty === 'DNF' || ms === null || ms === DNF_TIME) return 'DNF';

    let displayMs = ms;
    if (penalty === '+2') {
        displayMs = ms + 2000;
    }

    if (displayMs < 0) return '0.00';
    const seconds = Math.floor(displayMs / 1000);
    const centiseconds = Math.floor((displayMs % 1000) / 10);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    if (minutes > 0) {
        return `${minutes}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    }
    return `${secs}.${centiseconds.toString().padStart(2, '0')}`;
};

export const getFinalTime = (time, penalty) => {
    if (penalty === 'DNF') return DNF_TIME;
    if (penalty === '+2') return time + 2000;
    return time;
};

export const calculateBestSingle = (solves) => {
    if (!solves || solves.length === 0) return null;

    const validTimes = solves
        .map(s => getFinalTime(s.time, s.penalty))
        .filter(t => t !== DNF_TIME);

    if (validTimes.length === 0) return null;
    return Math.min(...validTimes);
};

const calculateAverage = (solveSubset) => {
    const times = solveSubset.map(s => getFinalTime(s.time, s.penalty));
    const dnfCount = times.filter(t => t === DNF_TIME).length;

    if (dnfCount > 1) return null;

    if (dnfCount === 1) {
        const validTimes = times.filter(t => t !== DNF_TIME);
        const sum = validTimes.reduce((a, b) => a + b, 0);
        return Math.round(sum / times.length);
    }

    const sorted = [...times].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    const sum = trimmed.reduce((a, b) => a + b, 0);
    return Math.round(sum / trimmed.length);
};

export const calculateAo5 = (solves) => {
    if (!solves || solves.length < 5) return null;
    return calculateAverage(solves.slice(0, 5));
};

export const calculateAo12 = (solves) => {
    if (!solves || solves.length < 12) return null;
    return calculateAverage(solves.slice(0, 12));
};

export const calculateAo50 = (solves) => {
    if (!solves || solves.length < 50) return null;
    return calculateAverage(solves.slice(0, 50));
};

export const calculateAo100 = (solves) => {
    if (!solves || solves.length < 100) return null;
    return calculateAverage(solves.slice(0, 100));
};

export const calculateAllStats = (solves) => {
    if (!solves || solves.length === 0) {
        return {
            bestTime: null,
            bestSingle: null,
            average: null,
            worstTime: null,
            ao5: null,
            ao12: null,
            ao50: null,
            ao100: null,
            totalSolves: 0
        };
    }

    const times = solves.map(s => getFinalTime(s.time, s.penalty));
    const validTimes = times.filter(t => t !== DNF_TIME);

    const best = validTimes.length > 0 ? Math.min(...validTimes) : null;
    const worst = validTimes.length > 0 ? Math.max(...validTimes) : null;
    const avg = validTimes.length > 0 ? Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length) : null;

    return {
        bestTime: best,
        bestSingle: best,
        average: avg,
        worstTime: worst,
        ao5: calculateAo5(solves),
        ao12: calculateAo12(solves),
        ao50: calculateAo50(solves),
        ao100: calculateAo100(solves),
        totalSolves: solves.length
    };
};

export const getSessionBests = (solves) => {
    if (!solves || solves.length === 0) return { best: null, worst: null };

    const times = solves.map(s => getFinalTime(s.time, s.penalty));
    const validTimes = times.filter(t => t !== DNF_TIME);

    return {
        best: validTimes.length > 0 ? Math.min(...validTimes) : null,
        worst: validTimes.length > 0 ? Math.max(...validTimes) : null
    };
};