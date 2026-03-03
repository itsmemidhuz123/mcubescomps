const API_URL = process.env.SCRAMBLE_API_URL || 'http://localhost:3000/api/scramble';
const API_KEY = process.env.SCRAMBLE_API_KEY;
const TIMEOUT_MS = 5000;

const VALID_EVENTS = ['333', '222', '444', '555', '666', '777', 'pyram', 'skewb', 'minx', 'sq1', 'clock'];

export class ScrambleError extends Error {
  code: string;
  constructor(message: string, code: string = 'SCRAMBLE_ERROR') {
    super(message);
    this.name = 'ScrambleError';
    this.code = code;
  }
}

function validateScrambleResponse(data, expectedCount) {
  if (!data) {
    throw new ScrambleError('No response from scramble API', 'NO_RESPONSE');
  }

  if (data.success !== true) {
    throw new ScrambleError(data.error || 'Scramble API returned error', 'API_ERROR');
  }

  if (!data.scrambles || !Array.isArray(data.scrambles)) {
    throw new ScrambleError('Invalid scrambles format', 'INVALID_FORMAT');
  }

  if (data.scrambles.length !== expectedCount) {
    throw new ScrambleError(`Expected ${expectedCount} scrambles, got ${data.scrambles.length}`, 'COUNT_MISMATCH');
  }

  for (const scramble of data.scrambles) {
    if (typeof scramble !== 'string' || scramble.trim().length === 0) {
      throw new ScrambleError('Invalid scramble: must be non-empty string', 'INVALID_SCRAMBLE');
    }
  }

  if (!data.scrambleId || typeof data.scrambleId !== 'string') {
    throw new ScrambleError('Missing or invalid scrambleId', 'MISSING_ID');
  }

  if (!data.event || !VALID_EVENTS.includes(data.event)) {
    throw new ScrambleError('Invalid event type', 'INVALID_EVENT');
  }

  return {
    scrambleId: data.scrambleId,
    event: data.event,
    scrambles: data.scrambles,
    count: data.scrambles.length,
  };
}

export async function generateScrambles(event = '333', count = 5) {
  if (!VALID_EVENTS.includes(event)) {
    throw new ScrambleError(`Invalid event: ${event}. Valid events: ${VALID_EVENTS.join(', ')}`, 'INVALID_EVENT');
  }

  if (typeof count !== 'number' || count < 1 || count > 20) {
    throw new ScrambleError('Count must be between 1 and 20', 'INVALID_COUNT');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (API_KEY) {
      headers['x-api-key'] = API_KEY;
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ event, count }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const status = response.status;
      if (status === 403) {
        throw new ScrambleError('Unauthorized: Invalid API key', 'UNAUTHORIZED');
      }
      if (status === 400) {
        const errorData = await response.json().catch(() => ({}));
        throw new ScrambleError(errorData.error || 'Bad request', 'BAD_REQUEST');
      }
      throw new ScrambleError(`Scramble API error: ${status}`, 'API_ERROR');
    }

    const data = await response.json();
    return validateScrambleResponse(data, count);
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new ScrambleError('Scramble request timed out', 'TIMEOUT');
    }

    if (error instanceof ScrambleError) {
      throw error;
    }

    throw new ScrambleError(`Network error: ${error.message}`, 'NETWORK_ERROR');
  }
}

export async function generateScrambleForBattle(battleConfig) {
  const { event = '333', roundCount = 5 } = battleConfig;

  const result = await generateScrambles(event, roundCount);

  return {
    scrambleId: result.scrambleId,
    event: result.event,
    scrambles: result.scrambles,
    currentScrambleIndex: 0,
  };
}

export { VALID_EVENTS };
