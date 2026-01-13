import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req);
    
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }
    
    // Get all users with their stats
    const result = await query(`
      SELECT 
        id,
        name,
        email,
        avatar,
        tokens,
        sessions,
        last_active,
        streak,
        created_at
      FROM users
      WHERE role = 'user'
      ORDER BY created_at DESC
    `);
    
    const users = result.rows.map((row: any) => ({
      id: row.id.toString(),
      name: row.name,
      email: row.email,
      avatar: row.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name)}&background=6366f1&color=fff`,
      tokens: parseInt(row.tokens) || 0,
      sessions: parseInt(row.sessions) || 0,
      lastActive: parseInt(row.last_active) || Date.now(),
      streak: parseInt(row.streak) || 0,
      mistakesFixed: []
    }));
    
    return NextResponse.json(users);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
