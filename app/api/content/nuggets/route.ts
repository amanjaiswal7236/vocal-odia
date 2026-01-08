import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/middleware';

export async function GET() {
  try {
    const result = await query('SELECT * FROM daily_nuggets ORDER BY date DESC, created_at DESC LIMIT 10');
    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching nuggets:', error);
    const errorMessage = error.message || 'Failed to fetch nuggets';
    return NextResponse.json(
      { 
        error: errorMessage,
        code: error.code,
        hint: error.code === 'ECONNREFUSED' 
          ? 'Database is not running. Please start PostgreSQL and ensure it is accessible.'
          : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const { word, definition, example } = await req.json();
    
    const result = await query(
      'INSERT INTO daily_nuggets (word, definition, example) VALUES ($1, $2, $3) RETURNING *',
      [word, definition, example]
    );
    
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    console.error('Error creating nugget:', error);
    return NextResponse.json(
      { error: 'Failed to create nugget' },
      { status: 500 }
    );
  }
}

