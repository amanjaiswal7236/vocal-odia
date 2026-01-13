import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/middleware';

export async function GET() {
  try {
    const result = await query('SELECT id, title, description, icon, prompt, image, created_at, updated_at FROM scenarios ORDER BY created_at DESC');
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
    const { title, description, icon, prompt, image } = await req.json();
    
    // Check if image column exists, if not add it
    try {
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'scenarios' AND column_name = 'image'
      `);
      
      if (columnCheck.rows.length === 0) {
        await query('ALTER TABLE scenarios ADD COLUMN image TEXT');
      }
    } catch (migrationError) {
      // Ignore migration errors, try to insert anyway
      console.log('Migration check:', migrationError);
    }
    
    // Try with image column first
    try {
      const result = await query(
        'INSERT INTO scenarios (title, description, icon, prompt, image) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [title, description, icon, prompt, image || null]
      );
      return NextResponse.json(result.rows[0]);
    } catch (insertError: any) {
      // If image column doesn't exist, insert without it
      if (insertError.message?.includes('column "image"')) {
        const result = await query(
          'INSERT INTO scenarios (title, description, icon, prompt) VALUES ($1, $2, $3, $4) RETURNING *',
          [title, description, icon, prompt]
        );
        return NextResponse.json(result.rows[0]);
      }
      throw insertError;
    }
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

