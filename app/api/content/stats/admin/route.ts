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
    
    // Get aggregated stats
    const statsResult = await query(`
      SELECT 
        COALESCE(SUM(tokens), 0) as total_tokens,
        COALESCE(SUM(sessions), 0) as total_sessions,
        COUNT(*) as total_users
      FROM users
      WHERE role = 'user'
    `);
    
    const stats = statsResult.rows[0];
    
    return NextResponse.json({
      tokensUsed: parseInt(stats.total_tokens) || 0,
      sessionsCount: parseInt(stats.total_sessions) || 0,
      uniqueUsers: parseInt(stats.total_users) || 0,
      lastActive: Date.now(),
      errorCount: 0
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin stats' },
      { status: 500 }
    );
  }
}
