const API_URL = process.env.NEXT_PUBLIC_SCRAMBLE_API_URL || '/api/scramble';
const API_KEY = process.env.SCRAMBLE_API_KEY;

export async function generateScrambles(event = '333', count = 5) {
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
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to generate scrambles');
    }

    const data = await response.json();
    
    return {
      success: true,
      scrambleId: data.scrambleId,
      event: data.event,
      scrambles: data.scrambles,
      count: data.count,
    };
  } catch (error) {
    console.error('Scramble generation error:', error);
    throw error;
  }
}

export async function generateScrambleForBattle(battleData) {
  const { event, roundCount = 5 } = battleData;
  
  const result = await generateScrambles(event, roundCount);
  
  return {
    scrambleId: result.scrambleId,
    scrambles: result.scrambles,
    event: result.event,
  };
}

export const SCRAMBLE_EVENTS = {
  '333': '3x3',
  '222': '2x2',
  '444': '4x4',
  '555': '5x5',
  '666': '6x6',
  '777': '7x7',
  'pyram': 'Pyraminx',
  'skewb': 'Skewb',
  'minx': 'Megaminx',
  'sq1': 'Square-1',
  'clock': 'Clock',
};
