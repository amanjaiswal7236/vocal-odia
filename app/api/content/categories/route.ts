import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/middleware';

export async function GET() {
  try {
    const result = await query(`
      SELECT id, name, description, order_index, created_at, updated_at
      FROM categories
      ORDER BY order_index ASC, name ASC
    `);
    const rows = result.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      order_index: r.order_index,
      orderIndex: r.order_index,
    }));
    return NextResponse.json(rows);
  } catch (error: any) {
    const msg = (error?.message || '').toLowerCase();
    if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('categories')) {
      return NextResponse.json([]);
    }
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const { name, description, order_index } = await req.json();
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }
    const result = await query(
      `INSERT INTO categories (name, description, order_index)
       VALUES ($1, $2, COALESCE($3, 0))
       RETURNING id, name, description, order_index, created_at, updated_at`,
      [name.trim(), description?.trim() || null, order_index ?? 0]
    );
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 409 }
      );
    }
    console.error('Error creating category:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create category' },
      { status: 500 }
    );
  }
}
