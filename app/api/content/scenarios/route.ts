import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/middleware';

export async function GET() {
  try {
    const result = await query('SELECT * FROM scenarios ORDER BY created_at DESC');
    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching scenarios:', error);
    const errorMessage = error.message || 'Failed to fetch scenarios';
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
    const { title, description, icon, prompt } = await req.json();
    
    const result = await query(
      'INSERT INTO scenarios (title, description, icon, prompt) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, description, icon, prompt]
    );
    
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    console.error('Error creating scenario:', error);
    return NextResponse.json(
      { error: 'Failed to create scenario' },
      { status: 500 }
    );
  }
}

