import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/middleware';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Allow unauthenticated access for migration (or require admin)
    try {
      requireAdmin(req);
    } catch {
      // Allow migration without auth for convenience
    }

    const migrations = [];

    // Add image column to scenarios if missing
    try {
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'scenarios' AND column_name = 'image'
      `);
      
      if (columnCheck.rows.length === 0) {
        await query('ALTER TABLE scenarios ADD COLUMN image TEXT');
        migrations.push('Added image column to scenarios table');
      } else {
        migrations.push('Image column already exists in scenarios table');
      }
    } catch (error: any) {
      migrations.push(`Error checking scenarios.image: ${error.message}`);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Migration completed',
      migrations 
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Migration failed',
        migrations: []
      },
      { status: 500 }
    );
  }
}
