import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { query } from '@/lib/db';

/**
 * Unlock a course for a user (when prerequisite is completed)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(req);
    const { id } = await params;
    const courseId = parseInt(id);

    // Verify course exists
    const courseCheck = await query(
      `SELECT id, prerequisite_id FROM courses WHERE id = $1`,
      [courseId]
    );

    if (courseCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const course = courseCheck.rows[0];

    // Check if prerequisite is completed (if exists)
    if (course.prerequisite_id) {
      // Get all lessons in prerequisite course
      const prerequisiteLessons = await query(`
        SELECT l.id
        FROM lessons l
        JOIN modules m ON l.module_id = m.id
        WHERE m.course_id = $1
      `, [course.prerequisite_id]);

      if (prerequisiteLessons.rows.length > 0) {
        // Check if all prerequisite lessons are completed
        const completedLessons = await query(`
          SELECT COUNT(*) as count
          FROM user_lesson_progress
          WHERE user_id = $1
            AND lesson_id = ANY($2::int[])
            AND completed = true
        `, [user.userId, prerequisiteLessons.rows.map((r: any) => r.id)]);

        const completedCount = parseInt(completedLessons.rows[0].count);
        if (completedCount < prerequisiteLessons.rows.length) {
          return NextResponse.json(
            { error: 'Prerequisite course not completed' },
            { status: 403 }
          );
        }
      }
    }

    // Update course to unlocked for this user
    // Note: is_unlocked in courses table is global, but we check prerequisite completion per user
    // For now, we'll just return success - the unlocking is handled by checking prerequisite completion
    // If you want per-user unlocking, you'd need a user_course_progress table
    
    return NextResponse.json({ success: true, unlocked: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Error unlocking course:', error);
    return NextResponse.json(
      { error: 'Failed to unlock course' },
      { status: 500 }
    );
  }
}
