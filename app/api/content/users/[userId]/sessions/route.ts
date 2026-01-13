import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = requireAuth(req);
    const { userId: userIdParam } = await params;
    const userId = parseInt(userIdParam);
    
    // Only admin can view any user's sessions, or users can view their own
    if (user.role !== 'admin' && user.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    // Get user sessions
    const result = await query(`
      SELECT 
        id,
        scenario_id,
        scenario_title,
        is_course_lesson,
        course_id,
        tokens_used,
        duration_seconds,
        started_at,
        ended_at
      FROM user_sessions
      WHERE user_id = $1
      ORDER BY started_at DESC
      LIMIT 100
    `, [userId]);
    
    const sessions = result.rows.map((row: any) => ({
      id: row.id.toString(),
      scenarioId: row.scenario_id,
      scenarioTitle: row.scenario_title || 'Unknown',
      isCourseLesson: row.is_course_lesson || false,
      courseId: row.course_id,
      tokensUsed: parseInt(row.tokens_used) || 0,
      durationSeconds: parseInt(row.duration_seconds) || 0,
      startedAt: new Date(row.started_at).getTime(),
      endedAt: row.ended_at ? new Date(row.ended_at).getTime() : null
    }));
    
    return NextResponse.json(sessions);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Error fetching user sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user sessions' },
      { status: 500 }
    );
  }
}
