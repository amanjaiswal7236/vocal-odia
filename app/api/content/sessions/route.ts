import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { scenarioId, scenarioTitle, isCourseLesson, courseId, tokensUsed, durationSeconds, startedAt } = await req.json();
    
    // Insert session record
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
        started_at, 
        ended_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8), NOW())
      RETURNING id
    `, [
      user.userId,
      scenarioId || null,
      scenarioTitle || 'Unknown',
      isCourseLesson || false,
      courseId || null,
      tokensUsed || 0,
      durationSeconds || 0,
      startedAtSeconds
    ]);
    
    // Update user's token and session count
    await query(`
      UPDATE users 
      SET tokens = tokens + $1, 
          sessions = sessions + 1,
          last_active = EXTRACT(EPOCH FROM NOW()) * 1000
      WHERE id = $2
    `, [tokensUsed || 0, user.userId]);
    
    return NextResponse.json({ 
      success: true, 
      sessionId: result.rows[0].id 
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Error recording session:', error);
    return NextResponse.json(
      { error: 'Failed to record session' },
      { status: 500 }
    );
  }
}
