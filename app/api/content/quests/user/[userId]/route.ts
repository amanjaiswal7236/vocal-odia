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
    
    let result = await query(
      'SELECT * FROM user_quests WHERE user_id = $1 AND date = CURRENT_DATE ORDER BY created_at',
      [userId]
    );
    
    // If no quests exist for today, create default ones
    if (result.rows.length === 0) {
      const defaultQuests = [
        { label: 'Complete 2 Live Sessions', target: 2, type: 'session' },
        { label: 'Practice 3 Pronunciation Sentences', target: 3, type: 'shadow' },
        { label: 'Refine 500+ Tokens', target: 500, type: 'word' }
      ];
      
      for (const quest of defaultQuests) {
        await query(
          'INSERT INTO user_quests (user_id, label, target, type) VALUES ($1, $2, $3, $4)',
          [userId, quest.label, quest.target, quest.type]
        );
      }
      
      result = await query(
        'SELECT * FROM user_quests WHERE user_id = $1 AND date = CURRENT_DATE ORDER BY created_at',
        [userId]
      );
    }
    
    return NextResponse.json(result.rows);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Error fetching quests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quests' },
      { status: 500 }
    );
  }
}

