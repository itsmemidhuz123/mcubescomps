import { NextResponse } from 'next/server';

export async function GET(request) {
  // Get IP from headers (works with Vercel/Next.js)
  let ip = request.headers.get('x-forwarded-for') || 
           request.headers.get('x-real-ip') || 
           'unknown';
           
  // If multiple IPs (proxy chain), take the first one
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  
  // Basic geo-location (mock for now, or use a service if available)
  // In a real production app, you might use a service like ipapi.co or maxmind
  // Vercel provides geo headers: x-vercel-ip-country, x-vercel-ip-city
  const country = request.headers.get('x-vercel-ip-country') || 'Unknown';
  const city = request.headers.get('x-vercel-ip-city') || 'Unknown';

  return NextResponse.json({ 
    ip,
    country,
    city
  });
}