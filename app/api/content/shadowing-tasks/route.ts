import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/middleware';

export async function GET() {
  try {
    const result = await query('SELECT * FROM shadowing_tasks ORDER BY order_index');
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching shadowing tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shadowing tasks' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const { text, translation, focus_area, order_index } = await req.json();
    
    const result = await query(
      'INSERT INTO shadowing_tasks (text, translation, focus_area, order_index) VALUES ($1, $2, $3, $4) RETURNING *',
      [text, translation, focus_area, order_index || 0]
    );
    
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    console.error('Error creating shadowing task:', error);
    return NextResponse.json(
      { error: 'Failed to create shadowing task' },
      { status: 500 }
    );
  }
}

