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
    
    // Get actual token usage from sessions table (more accurate)
    const tokensResult = await query(`
      SELECT COALESCE(SUM(tokens_used), 0) as total_tokens
      FROM user_sessions
    `);
    
    // Get session count
    const sessionsResult = await query(`
      SELECT COUNT(*) as total_sessions
      FROM user_sessions
    `);
    
    // Get unique users count
    const usersResult = await query(`
      SELECT COUNT(DISTINCT user_id) as total_users
      FROM user_sessions
    `);
    
    // Get token usage over last 7 days for graph
    const dailyTokensResult = await query(`
      SELECT 
        DATE(started_at) as date,
        SUM(tokens_used) as tokens
      FROM user_sessions
      WHERE started_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(started_at)
      ORDER BY DATE(started_at)
    `);
    
    // Get token usage by user (top 10)
    const userTokensResult = await query(`
      SELECT 
        u.id,
        u.name,
        u.avatar,
        SUM(us.tokens_used) as total_tokens,
        COUNT(us.id) as session_count
      FROM users u
      LEFT JOIN user_sessions us ON u.id = us.user_id
      WHERE u.role = 'user'
      GROUP BY u.id, u.name, u.avatar
      ORDER BY total_tokens DESC NULLS LAST
      LIMIT 10
    `);
    
    return NextResponse.json({
      tokensUsed: parseInt(tokensResult.rows[0]?.total_tokens || '0'),
      sessionsCount: parseInt(sessionsResult.rows[0]?.total_sessions || '0'),
      uniqueUsers: parseInt(usersResult.rows[0]?.total_users || '0'),
      lastActive: Date.now(),
      errorCount: 0,
      dailyTokens: dailyTokensResult.rows.map((row: any) => ({
        date: row.date,
        tokens: parseInt(row.tokens || '0')
      })),
      userTokens: userTokensResult.rows.map((row: any) => ({
        userId: row.id.toString(),
        name: row.name,
        avatar: row.avatar,
        tokens: parseInt(row.total_tokens || '0'),
        sessions: parseInt(row.session_count || '0')
      }))
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
