import { NextResponse } from 'next/server';

export async function GET(request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  return NextResponse.json({ ip });
}