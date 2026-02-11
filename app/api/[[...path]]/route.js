import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Helper to get user from session
async function getUserFromSession(request) {
  const authHeader = request.headers.get('authorization');
  const cookieHeader = request.headers.get('cookie');
  
  let sessionToken = null;
  
  // Check Authorization header first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    sessionToken = authHeader.substring(7);
  }
  
  // Fallback to cookie
  if (!sessionToken && cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const sessionCookie = cookies.find(c => c.startsWith('session_token='));
    if (sessionCookie) {
      sessionToken = sessionCookie.split('=')[1];
    }
  }
  
  if (!sessionToken) {
    return null;
  }
  
  try {
    const session = await prisma.userSession.findUnique({
      where: { sessionToken },
      include: { user: true }
    });
    
    if (!session) return null;
    
    // Check if session expired
    if (new Date(session.expiresAt) < new Date()) {
      await prisma.userSession.delete({ where: { id: session.id } });
      return null;
    }
    
    return session.user;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

// POST /api/auth/session - Exchange session_id for user data
export async function POST(request) {
  const { pathname } = new URL(request.url);
  
  if (pathname === '/api/auth/session') {
    try {
      const { session_id } = await request.json();
      
      if (!session_id) {
        return NextResponse.json({ error: 'session_id required' }, { status: 400 });
      }
      
      // Call Emergent Auth API
      const response = await fetch('https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data', {
        headers: {
          'X-Session-ID': session_id
        }
      });
      
      if (!response.ok) {
        return NextResponse.json({ error: 'Invalid session_id' }, { status: 401 });
      }
      
      const data = await response.json();
      const { id, email, name, picture, session_token } = data;
      
      // Check if user exists, if not create
      let user = await prisma.user.findUnique({ where: { email } });
      
      if (!user) {
        // First user becomes admin
        const userCount = await prisma.user.count();
        user = await prisma.user.create({
          data: {
            email,
            name: name || email.split('@')[0],
            picture,
            isAdmin: userCount === 0
          }
        });
      } else {
        // Update user info
        user = await prisma.user.update({
          where: { email },
          data: { name: name || user.name, picture: picture || user.picture }
        });
      }
      
      // Create session
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await prisma.userSession.create({
        data: {
          userId: user.id,
          sessionToken: session_token,
          expiresAt
        }
      });
      
      // Return user data and set cookie
      const res = NextResponse.json({
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        isAdmin: user.isAdmin
      });
      
      res.cookies.set('session_token', session_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: 7 * 24 * 60 * 60
      });
      
      return res;
    } catch (error) {
      console.error('Session exchange error:', error);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }
  
  // POST /api/competitions - Create competition (admin only)
  if (pathname === '/api/competitions') {
    try {
      const user = await getUserFromSession(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      
      const data = await request.json();
      const { name, slug, startDate, endDate, scrambles } = data;
      
      // Create competition with scrambles
      const competition = await prisma.competition.create({
        data: {
          name,
          slug,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status: 'upcoming',
          scrambles: {
            create: scrambles.map((text, index) => ({
              scrambleNumber: index + 1,
              scrambleText: text
            }))
          }
        },
        include: { scrambles: true }
      });
      
      return NextResponse.json(competition);
    } catch (error) {
      console.error('Create competition error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  
  // POST /api/competitions/:id/start - Start competition
  if (pathname.match(/\/api\/competitions\/[^/]+\/start$/)) {
    try {
      const user = await getUserFromSession(request);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const competitionId = pathname.split('/')[3];
      
      // Check if user already started
      const existing = await prisma.result.findUnique({
        where: {
          competitionId_userId: {
            competitionId,
            userId: user.id
          }
        }
      });
      
      if (existing) {
        return NextResponse.json({ error: 'Already started' }, { status: 400 });
      }
      
      // Create result record
      const result = await prisma.result.create({
        data: {
          competitionId,
          userId: user.id,
          status: 'started',
          attempt: 0
        }
      });
      
      return NextResponse.json(result);
    } catch (error) {
      console.error('Start competition error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  
  // POST /api/results/:id/submit - Submit solve time
  if (pathname.match(/\/api\/results\/[^/]+\/submit$/)) {
    try {
      const user = await getUserFromSession(request);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const resultId = pathname.split('/')[3];
      const { time, penalty } = await request.json();
      
      // Get result and verify ownership
      const result = await prisma.result.findUnique({
        where: { id: resultId }
      });
      
      if (!result || result.userId !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      
      if (result.status === 'completed') {
        return NextResponse.json({ error: 'Competition already completed' }, { status: 400 });
      }
      
      const nextAttempt = result.attempt + 1;
      if (nextAttempt > 5) {
        return NextResponse.json({ error: 'All attempts completed' }, { status: 400 });
      }
      
      // Update result with new time
      const updateData = {
        attempt: nextAttempt,
        [`time${nextAttempt}`]: time,
        [`penalty${nextAttempt}`]: penalty
      };
      
      if (nextAttempt === 5) {
        updateData.status = 'completed';
      }
      
      const updated = await prisma.result.update({
        where: { id: resultId },
        data: updateData
      });
      
      return NextResponse.json(updated);
    } catch (error) {
      console.error('Submit solve error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  
  // Default 404
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// GET routes
export async function GET(request) {
  const { pathname } = new URL(request.url);
  
  // GET /api/auth/me - Get current user
  if (pathname === '/api/auth/me') {
    try {
      const user = await getUserFromSession(request);
      if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      
      return NextResponse.json({
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        isAdmin: user.isAdmin
      });
    } catch (error) {
      console.error('Get user error:', error);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }
  
  // GET /api/competitions - List all competitions
  if (pathname === '/api/competitions') {
    try {
      const competitions = await prisma.competition.findMany({
        orderBy: { startDate: 'desc' },
        include: {
          _count: {
            select: { results: { where: { status: 'completed' } } }
          }
        }
      });
      
      return NextResponse.json(competitions);
    } catch (error) {
      console.error('List competitions error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  
  // GET /api/competitions/:slug - Get competition by slug
  if (pathname.match(/\/api\/competitions\/[^/]+$/) && !pathname.includes('/leaderboard') && !pathname.includes('/my-result')) {
    try {
      const slug = pathname.split('/').pop();
      const competition = await prisma.competition.findUnique({
        where: { slug },
        include: {
          scrambles: { orderBy: { scrambleNumber: 'asc' } }
        }
      });
      
      if (!competition) {
        return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
      }
      
      return NextResponse.json(competition);
    } catch (error) {
      console.error('Get competition error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  
  // GET /api/competitions/:slug/my-result - Get user's result
  if (pathname.match(/\/api\/competitions\/[^/]+\/my-result$/)) {
    try {
      const user = await getUserFromSession(request);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const slug = pathname.split('/')[3];
      const competition = await prisma.competition.findUnique({ where: { slug } });
      
      if (!competition) {
        return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
      }
      
      const result = await prisma.result.findUnique({
        where: {
          competitionId_userId: {
            competitionId: competition.id,
            userId: user.id
          }
        }
      });
      
      return NextResponse.json(result || null);
    } catch (error) {
      console.error('Get my result error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  
  // GET /api/competitions/:slug/leaderboard - Get leaderboard
  if (pathname.match(/\/api\/competitions\/[^/]+\/leaderboard$/)) {
    try {
      const slug = pathname.split('/')[3];
      const competition = await prisma.competition.findUnique({ where: { slug } });
      
      if (!competition) {
        return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
      }
      
      const results = await prisma.result.findMany({
        where: {
          competitionId: competition.id,
          status: 'completed'
        },
        include: { user: true }
      });
      
      // Calculate Ao5 (average of 5, drop best and worst)
      const leaderboard = results.map(result => {
        const times = [result.time1, result.time2, result.time3, result.time4, result.time5];
        const penalties = [result.penalty1, result.penalty2, result.penalty3, result.penalty4, result.penalty5];
        
        // Apply penalties
        const adjustedTimes = times.map((time, i) => {
          if (penalties[i] === 'DNF') return Infinity;
          if (penalties[i] === '+2') return time + 2000;
          return time;
        });
        
        // Check if more than 1 DNF
        const dnfCount = adjustedTimes.filter(t => t === Infinity).length;
        if (dnfCount > 1) {
          return {
            userId: result.userId,
            userName: result.user.name,
            userEmail: result.user.email,
            userPicture: result.user.picture,
            times,
            penalties,
            average: 'DNF',
            isDNF: true
          };
        }
        
        // Calculate Ao5: drop best and worst, average the middle 3
        const sorted = [...adjustedTimes].sort((a, b) => a - b);
        const middle3 = sorted.slice(1, 4);
        const average = middle3.reduce((a, b) => a + b, 0) / 3;
        
        return {
          userId: result.userId,
          userName: result.user.name,
          userEmail: result.user.email,
          userPicture: result.user.picture,
          times,
          penalties,
          average,
          isDNF: false
        };
      });
      
      // Sort by average (DNF at bottom)
      leaderboard.sort((a, b) => {
        if (a.isDNF && !b.isDNF) return 1;
        if (!a.isDNF && b.isDNF) return -1;
        if (a.isDNF && b.isDNF) return 0;
        return a.average - b.average;
      });
      
      return NextResponse.json(leaderboard);
    } catch (error) {
      console.error('Get leaderboard error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  
  // GET /api/results/:id - Get result by ID
  if (pathname.match(/\/api\/results\/[^/]+$/) && !pathname.includes('/submit')) {
    try {
      const user = await getUserFromSession(request);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const resultId = pathname.split('/').pop();
      const result = await prisma.result.findUnique({
        where: { id: resultId }
      });
      
      if (!result) {
        return NextResponse.json({ error: 'Result not found' }, { status: 404 });
      }
      
      // Verify ownership
      if (result.userId !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      
      return NextResponse.json(result);
    } catch (error) {
      console.error('Get result error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  
  // GET /api/auth/logout - Logout
  if (pathname === '/api/auth/logout') {
    try {
      const user = await getUserFromSession(request);
      if (user) {
        // Delete all sessions for user
        await prisma.userSession.deleteMany({ where: { userId: user.id } });
      }
      
      const res = NextResponse.json({ message: 'Logged out' });
      res.cookies.delete('session_token');
      return res;
    } catch (error) {
      console.error('Logout error:', error);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }
  
  // Default hello
  return NextResponse.json({ message: 'Speedcubing API' });
}
