import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json({
        error: 'Client-side only',
        message: 'Scrambles are generated client-side using cubing.js'
    }, { status: 200 });
}

export async function GET() {
    return NextResponse.json({
        message: 'Scrambles are generated client-side using cubing.js CDN',
        // cdn: removed; scrambles generated client-side
    });
}
