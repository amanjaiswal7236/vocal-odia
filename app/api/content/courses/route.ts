import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/middleware';

export async function GET() {
  try {
    const coursesResult = await query('SELECT * FROM courses ORDER BY id');
    const courses = coursesResult.rows;

    for (const course of courses) {
      const modulesResult = await query(
        'SELECT * FROM modules WHERE course_id = $1 ORDER BY order_index',
        [course.id]
      );
      course.modules = modulesResult.rows;

      for (const module of course.modules) {
        const lessonsResult = await query(
          'SELECT * FROM lessons WHERE module_id = $1 ORDER BY order_index',
          [module.id]
        );
        module.lessons = lessonsResult.rows;
      }
    }

    return NextResponse.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courses' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const { title, level, description, prerequisite_id, is_unlocked, modules } = await req.json();
    
    const courseResult = await query(
      'INSERT INTO courses (title, level, description, prerequisite_id, is_unlocked) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, level, description, prerequisite_id || null, is_unlocked || false]
    );
    const course = courseResult.rows[0];

    if (modules && modules.length > 0) {
      for (let mIdx = 0; mIdx < modules.length; mIdx++) {
        const module = modules[mIdx];
        const moduleResult = await query(
          'INSERT INTO modules (course_id, title, order_index) VALUES ($1, $2, $3) RETURNING *',
          [course.id, module.title, mIdx]
        );
        const newModule = moduleResult.rows[0];

        if (module.lessons && module.lessons.length > 0) {
          for (let lIdx = 0; lIdx < module.lessons.length; lIdx++) {
            const lesson = module.lessons[lIdx];
            await query(
              'INSERT INTO lessons (module_id, title, objective, prompt, order_index) VALUES ($1, $2, $3, $4, $5)',
              [newModule.id, lesson.title, lesson.objective, lesson.prompt, lIdx]
            );
          }
        }
      }
    }

    return NextResponse.json(course);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    console.error('Error creating course:', error);
    return NextResponse.json(
      { error: 'Failed to create course' },
      { status: 500 }
    );
  }
}

