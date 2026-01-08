import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query('SELECT * FROM badges ORDER BY threshold');
    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching badges:', error);
    const errorMessage = error.message || 'Failed to fetch badges';
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

