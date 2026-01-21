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

    const coursesResult = await query('SELECT * FROM courses ORDER BY id');
    const courses = coursesResult.rows;

    for (const course of courses) {
      // Check if course is unlocked based on prerequisite completion
      let isUnlocked = course.is_unlocked || false;
      
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
          `, [userId, prerequisiteLessons.rows.map((r: any) => r.id)]);

          const completedCount = parseInt(completedLessons.rows[0].count);
          isUnlocked = completedCount >= prerequisiteLessons.rows.length;
        } else {
          // No lessons in prerequisite, consider it unlocked if prerequisite exists
          isUnlocked = true;
        }
      }
      
      course.is_unlocked = isUnlocked;

      const modulesResult = await query(
        'SELECT * FROM modules WHERE course_id = $1 ORDER BY order_index',
        [course.id]
      );
      course.modules = modulesResult.rows;

      for (const module of course.modules) {
        const lessonsResult = await query(
          `SELECT l.*, COALESCE(ulp.completed, false) as completed 
           FROM lessons l 
           LEFT JOIN user_lesson_progress ulp ON l.id = ulp.lesson_id AND ulp.user_id = $1
           WHERE l.module_id = $2 
           ORDER BY l.order_index`,
          [userId, module.id]
        );
        module.lessons = lessonsResult.rows;
      }
    }

    return NextResponse.json(courses);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Error fetching user courses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courses' },
      { status: 500 }
    );
  }
}

