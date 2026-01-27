import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/middleware';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('category_id') || searchParams.get('categoryId');
    let result: { rows: any[] };

    const queryWithCategories = async () => {
      if (categoryId) {
        return query(`
          SELECT s.id, s.title, s.description, s.icon, s.prompt, s.image,
                 s.temperature, s.top_p, s.top_k, s.max_output_tokens,
                 s.category_id, s.created_at, s.updated_at,
                 c.name AS category_name, c.description AS category_description, c.order_index AS category_order_index
          FROM scenarios s
          LEFT JOIN categories c ON c.id = s.category_id
          WHERE s.category_id = $1
          ORDER BY s.created_at DESC
        `, [categoryId]);
      }
      return query(`
        SELECT s.id, s.title, s.description, s.icon, s.prompt, s.image,
               s.temperature, s.top_p, s.top_k, s.max_output_tokens,
               s.category_id, s.created_at, s.updated_at,
               c.name AS category_name, c.description AS category_description, c.order_index AS category_order_index
        FROM scenarios s
        LEFT JOIN categories c ON c.id = s.category_id
        ORDER BY COALESCE(c.order_index, 999) ASC, c.name ASC, s.created_at DESC
      `);
    };

    const queryWithoutCategories = async () => {
      const baseCols = 'id, title, description, icon, prompt, image, temperature, top_p, top_k, max_output_tokens, created_at, updated_at';
      const q = categoryId
        ? await query(
            `SELECT ${baseCols}, category_id FROM scenarios WHERE category_id = $1 ORDER BY created_at DESC`,
            [categoryId]
          )
        : await query(
            `SELECT ${baseCols}, category_id FROM scenarios ORDER BY created_at DESC`
          );
      return { rows: q.rows.map((r: any) => ({ ...r, category_name: null, category_description: null, category_order_index: null })) };
    };

    // When category_id column or categories table is missing — use minimal columns for max compatibility
    const queryLegacy = async (): Promise<{ rows: any[] }> => {
      const cols = 'id, title, description, icon, prompt, created_at, updated_at';
      const q = await query(`SELECT ${cols} FROM scenarios ORDER BY created_at DESC`);
      const rows = (q.rows as any[]).map((r: any) => ({
        ...r,
        image: r.image ?? null,
        temperature: r.temperature ?? null,
        top_p: r.top_p ?? null,
        top_k: r.top_k ?? null,
        max_output_tokens: r.max_output_tokens ?? null,
        category_id: null,
        category_name: null,
        category_description: null,
        category_order_index: null,
      }));
      return { rows: categoryId ? [] : rows };
    };

    try {
      result = await queryWithCategories();
    } catch (schemaErr: any) {
      const msg = (schemaErr?.message || '').toLowerCase();
      const missingCategory = msg.includes('categories') || msg.includes('category_id');
      if (missingCategory) {
        try {
          result = await queryWithoutCategories();
        } catch {
          result = await queryLegacy();
        }
      } else {
        throw schemaErr;
      }
    }

    const rows = result.rows.map((r: any) => ({
      ...r,
      category_id: r.category_id ?? null,
      category: r.category_id != null && r.category_name ? {
        id: String(r.category_id),
        name: r.category_name,
        description: r.category_description,
        orderIndex: r.category_order_index,
      } : null,
    }));
    return NextResponse.json(rows);
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
    const { title, description, icon, prompt, image, temperature, topP, topK, maxOutputTokens, category_id, categoryId } = await req.json();
    const catId = category_id ?? categoryId;
    
    // Build dynamic query based on available columns
    const columns = ['title', 'description', 'icon', 'prompt'];
    const values = [title, description, icon, prompt];
    const placeholders = ['$1', '$2', '$3', '$4'];
    let paramIndex = 5;
    
    if (catId !== undefined && catId !== null && catId !== '') {
      columns.push('category_id');
      values.push(typeof catId === 'number' ? catId : parseInt(String(catId), 10));
      placeholders.push(`$${paramIndex++}`);
    }
    
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

