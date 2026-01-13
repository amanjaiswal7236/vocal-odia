import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/middleware';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAdmin(req);
    const { title, description, icon, prompt, image } = await req.json();
    const { id } = await params;
    
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
      // Ignore migration errors, try to update anyway
      console.log('Migration check:', migrationError);
    }
    
    // Try with image column first
    try {
      const result = await query(
        'UPDATE scenarios SET title = $1, description = $2, icon = $3, prompt = $4, image = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
        [title, description, icon, prompt, image || null, id]
      );
      
      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Scenario not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(result.rows[0]);
    } catch (updateError: any) {
      // If image column doesn't exist, update without it
      if (updateError.message?.includes('column "image"')) {
        const result = await query(
          'UPDATE scenarios SET title = $1, description = $2, icon = $3, prompt = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
          [title, description, icon, prompt, id]
        );
        
        if (result.rows.length === 0) {
          return NextResponse.json(
            { error: 'Scenario not found' },
            { status: 404 }
          );
        }
        
        return NextResponse.json(result.rows[0]);
      }
      throw updateError;
    }
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    console.error('Error updating scenario:', error);
    return NextResponse.json(
      { error: 'Failed to update scenario' },
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
    await query('DELETE FROM scenarios WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    console.error('Error deleting scenario:', error);
    return NextResponse.json(
      { error: 'Failed to delete scenario' },
      { status: 500 }
    );
  }
}

