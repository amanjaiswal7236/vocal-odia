import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAdmin(req);
    const { title, level, description, prerequisite_id, is_unlocked, modules, category_id, categoryId } = await req.json();
    const { id } = await params;
    const catId = category_id ?? categoryId;
    const resolvedCatId = (catId != null && catId !== '') ? (typeof catId === 'number' ? catId : parseInt(String(catId), 10)) : null;
    
    // Update course
    const result = await query(
      'UPDATE courses SET title = $1, level = $2, description = $3, prerequisite_id = $4, is_unlocked = $5, category_id = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *',
      [title, level, description, prerequisite_id || null, is_unlocked ?? false, resolvedCatId, id]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }
    
    const course = result.rows[0];
    
    // If modules are provided, update them
    if (modules && modules.length > 0) {
      // Delete existing modules and lessons
      await query('DELETE FROM lessons WHERE module_id IN (SELECT id FROM modules WHERE course_id = $1)', [id]);
      await query('DELETE FROM modules WHERE course_id = $1', [id]);
      
      // Insert new modules
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
    console.error('Error updating course:', error);
    return NextResponse.json(
      { error: 'Failed to update course' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAdmin(req);
    const { id } = await params;
    await query('DELETE FROM courses WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    console.error('Error deleting course:', error);
    return NextResponse.json(
      { error: 'Failed to delete course' },
      { status: 500 }
    );
  }
}
