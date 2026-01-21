import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { query } from '@/lib/db';

/**
 * Mark a lesson as completed for a user
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const user = requireAuth(req);
    const { lessonId } = await params;

    // Check if lesson exists
    const lessonCheck = await query(
      `SELECT id FROM lessons WHERE id = $1`,
      [parseInt(lessonId)]
    );

    if (lessonCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Insert or update lesson progress
    await query(`
      INSERT INTO user_lesson_progress (user_id, lesson_id, completed, completed_at)
      VALUES ($1, $2, true, NOW())
      ON CONFLICT (user_id, lesson_id)
      DO UPDATE SET completed = true, completed_at = NOW()
    `, [user.userId, parseInt(lessonId)]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Error marking lesson as completed:', error);
    return NextResponse.json(
      { error: 'Failed to mark lesson as completed' },
      { status: 500 }
    );
  }
}
