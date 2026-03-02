export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAllUsersWithVerification, getAllUsers } from '@/lib/firebase-admin';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'all';
        const limit = parseInt(searchParams.get('limit') || '100');

        console.log('Fetching users, type:', type, 'limit:', limit);

        let result;

        if (type === 'verification') {
            result = await getAllUsersWithVerification(limit);
        } else {
            result = await getAllUsers(limit);
        }

        if (result.error) {
            console.error('Error fetching users:', result.error);
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        console.log('Fetched users count:', result.users.length);

        return NextResponse.json({
            users: result.users,
            count: result.users.length
        });

    } catch (error) {
        console.error('Users API error:', error.message);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}