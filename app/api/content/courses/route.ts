import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/middleware';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('category_id') || searchParams.get('categoryId');
    const coursesResult = categoryId
      ? await query(
          `SELECT c.*, cat.name AS category_name, cat.description AS category_description, cat.order_index AS category_order_index
           FROM courses c
           LEFT JOIN categories cat ON cat.id = c.category_id
           WHERE c.category_id = $1
           ORDER BY c.id`,
          [categoryId]
        )
      : await query(`
          SELECT c.*, cat.name AS category_name, cat.description AS category_description, cat.order_index AS category_order_index
          FROM courses c
          LEFT JOIN categories cat ON cat.id = c.category_id
          ORDER BY COALESCE(cat.order_index, 999) ASC, cat.name ASC, c.id
        `);
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
    const { title, level, description, prerequisite_id, is_unlocked, modules, category_id, categoryId } = await req.json();
    const catId = category_id ?? categoryId;
    
    const courseResult = await query(
      'INSERT INTO courses (title, level, description, prerequisite_id, category_id, is_unlocked) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title, level, description, prerequisite_id || null, (catId != null && catId !== '') ? (typeof catId === 'number' ? catId : parseInt(String(catId), 10)) : null, is_unlocked ?? false]
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

