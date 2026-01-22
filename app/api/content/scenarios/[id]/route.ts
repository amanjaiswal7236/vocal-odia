import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/middleware';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAdmin(req);
    const { title, description, icon, prompt, image, temperature, topP, topK, maxOutputTokens } = await req.json();
    const { id } = await params;
    
    // Build dynamic update query
    const updates = ['title = $1', 'description = $2', 'icon = $3', 'prompt = $4', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [title, description, icon, prompt];
    let paramIndex = 5;
    
    // Add optional columns
    if (image !== undefined) {
      updates.push(`image = $${paramIndex++}`);
      values.push(image || null);
    }
    
    if (temperature !== undefined) {
      updates.push(`temperature = $${paramIndex++}`);
      values.push(temperature);
    }
    
    if (topP !== undefined) {
      updates.push(`top_p = $${paramIndex++}`);
      values.push(topP);
    }
    
    if (topK !== undefined) {
      updates.push(`top_k = $${paramIndex++}`);
      values.push(topK);
    }
    
    if (maxOutputTokens !== undefined) {
      updates.push(`max_output_tokens = $${paramIndex++}`);
      values.push(maxOutputTokens);
    }
    
    values.push(id); // Add id for WHERE clause
    
    const queryText = `
      UPDATE scenarios 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex} 
      RETURNING *
    `;
    
    try {
      const result = await query(queryText, values);
      
      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Scenario not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(result.rows[0]);
    } catch (updateError: any) {
      // Fallback to basic update if columns don't exist
      console.error('Update error:', updateError);
      const basicResult = await query(
        'UPDATE scenarios SET title = $1, description = $2, icon = $3, prompt = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
        [title, description, icon, prompt, id]
      );
      
      if (basicResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Scenario not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(basicResult.rows[0]);
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

