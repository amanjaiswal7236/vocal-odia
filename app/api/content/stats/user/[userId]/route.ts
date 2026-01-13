import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = requireAuth(req);
    const { userId: userIdParam } = await params;
    const userId = parseInt(userIdParam);
    
    if (user.userId !== userId && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    const result = await query(
      'SELECT tokens, sessions, last_active FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const userData = result.rows[0];
    return NextResponse.json({
      tokensUsed: userData.tokens || 0,
      sessionsCount: userData.sessions || 0,
      lastActive: parseInt(userData.last_active) || Date.now(),
      errorCount: 0
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

