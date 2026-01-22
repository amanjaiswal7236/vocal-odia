import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/middleware';

export async function GET() {
  try {
    const result = await query(`
      SELECT id, title, description, icon, prompt, image, 
             temperature, top_p, top_k, max_output_tokens,
             created_at, updated_at 
      FROM scenarios 
      ORDER BY created_at DESC
    `);
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
    const { title, description, icon, prompt, image, temperature, topP, topK, maxOutputTokens } = await req.json();
    
    // Build dynamic query based on available columns
    const columns = ['title', 'description', 'icon', 'prompt'];
    const values = [title, description, icon, prompt];
    const placeholders = ['$1', '$2', '$3', '$4'];
    let paramIndex = 5;
    
    // Add optional columns
    if (image !== undefined) {
      columns.push('image');
      values.push(image || null);
      placeholders.push(`$${paramIndex++}`);
    }
    
    if (temperature !== undefined && temperature !== null) {
      columns.push('temperature');
      values.push(temperature);
      placeholders.push(`$${paramIndex++}`);
    }
    
    if (topP !== undefined && topP !== null) {
      columns.push('top_p');
      values.push(topP);
      placeholders.push(`$${paramIndex++}`);
    }
    
    if (topK !== undefined && topK !== null) {
      columns.push('top_k');
      values.push(topK);
      placeholders.push(`$${paramIndex++}`);
    }
    
    if (maxOutputTokens !== undefined && maxOutputTokens !== null) {
      columns.push('max_output_tokens');
      values.push(maxOutputTokens);
      placeholders.push(`$${paramIndex++}`);
    }
    
    const queryText = `
      INSERT INTO scenarios (${columns.join(', ')}) 
      VALUES (${placeholders.join(', ')}) 
      RETURNING *
    `;
    
    try {
      const result = await query(queryText, values);
      return NextResponse.json(result.rows[0]);
    } catch (insertError: any) {
      // If columns don't exist, try without them
      console.error('Insert error:', insertError);
      const basicResult = await query(
        'INSERT INTO scenarios (title, description, icon, prompt) VALUES ($1, $2, $3, $4) RETURNING *',
        [title, description, icon, prompt]
      );
      return NextResponse.json(basicResult.rows[0]);
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

