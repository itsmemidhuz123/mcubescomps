import { NextResponse } from 'next/server';

const SCRAMBLE_LENGTHS = {
  '222': 11, '333': 25, '444': 40, '555': 60, '666': 80, '777': 100,
  'pyram': 11, 'skewb': 11, 'clock': 17, 'sq1': 40, 'minx': 70,
};

const PUZZLE_MOVES = {
  '333': ['R', 'L', 'U', 'D', 'F', 'B'],
  '222': ['R', 'L', 'U', 'D', 'F', 'B'],
  '444': ['R', 'L', 'U', 'D', 'F', 'B', 'Rw', 'Lw', 'Uw', 'Dw', 'Fw', 'Bw'],
  '555': ['R', 'L', 'U', 'D', 'F', 'B', 'Rw', 'Lw', 'Uw', 'Dw', 'Fw', 'Bw'],
  '666': ['R', 'L', 'U', 'D', 'F', 'B', 'Rw', 'Lw', 'Uw', 'Dw', 'Fw', 'Bw', '3Rw', '3Lw'],
  '777': ['R', 'L', 'U', 'D', 'F', 'B', 'Rw', 'Lw', 'Uw', 'Dw', 'Fw', 'Bw', '3Rw', '3Lw'],
  'pyram': ['R', 'L', 'U', 'B'],
  'skewb': ['R', 'L', 'U', 'B'],
  'clock': ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'],
  'sq1': ['/', '(', ')', 'U', 'D', 'R', 'L', 'B', 'F'],
  'minx': ['R', 'L', 'U', 'D', 'F', 'B', 'LD', 'RD', 'DF', 'DR', 'UF', 'UB'],
};

const MODIFIERS = ['', "'", '2'];

function generateScramble(eventId) {
  const moves = PUZZLE_MOVES[eventId] || PUZZLE_MOVES['333'];
  const length = SCRAMBLE_LENGTHS[eventId] || 25;
  
  const scramble = [];
  let lastMove = '';
  let lastGroup = '';
  
  for (let i = 0; i < length; i++) {
    let move;
    let attempts = 0;
    
    do {
      move = moves[Math.floor(Math.random() * moves.length)];
      attempts++;
    } while (attempts < 20 && (move === lastMove || (move.length > 1 && move[0] === lastGroup)));
    
    let modifier = eventId === 'clock' 
      ? (Math.random() < 0.5 ? '+' : '-')
      : MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];
    
    scramble.push(move + modifier);
    lastMove = move;
    lastGroup = move.charAt(0);
  }
  
  return scramble.join(' ');
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const event = searchParams.get('event') || '333';
  
  const scramble = generateScramble(event);
  
  return NextResponse.json({ scramble, event });
}

export async function POST() {
  return NextResponse.json({
    error: 'Use GET method',
    message: 'GET /api/scramble?event=333'
  }, { status: 405 });
}
