import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';

/**
 * Create a session early (at conversation start) to get sessionId for real-time audio uploads
 */
export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { scenarioId, scenarioTitle, isCourseLesson, courseId, startedAt } = await req.json();
    
    // Convert startedAt from milliseconds to seconds for PostgreSQL
    const startedAtSeconds = Math.floor((startedAt || Date.now()) / 1000);
    
    const result = await query(`
      INSERT INTO user_sessions (
        user_id, 
        scenario_id, 
        scenario_title, 
        is_course_lesson, 
        course_id, 
        tokens_used, 
        duration_seconds, 
        started_at
      ) VALUES ($1, $2, $3, $4, $5, 0, 0, to_timestamp($6))
      RETURNING id
    `, [
      user.userId,
      scenarioId || null,
      scenarioTitle || 'Unknown',
      isCourseLesson || false,
      courseId || null,
      startedAtSeconds
    ]);
    
    const sessionId = result.rows[0].id;
    
    return NextResponse.json({ 
      success: true, 
      sessionId: sessionId 
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Error creating early session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
