import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/middleware';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await query(
      'SELECT id, name, description, order_index, created_at, updated_at FROM categories WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    const r = result.rows[0];
    return NextResponse.json({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      order_index: r.order_index,
      orderIndex: r.order_index,
    });
  } catch (error: any) {
    console.error('Error fetching category:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch category' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAdmin(req);
    const { id } = await params;
    const { name, description, order_index } = await req.json();
    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const values: any[] = [];
    let paramIndex = 1;
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(typeof name === 'string' ? name.trim() : name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description === null || description === '' ? null : String(description).trim());
    }
    if (order_index !== undefined) {
      updates.push(`order_index = $${paramIndex++}`);
      values.push(typeof order_index === 'number' ? order_index : parseInt(String(order_index), 10) || 0);
    }
    if (values.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }
    values.push(id);
    const result = await query(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, description, order_index, created_at, updated_at`,
      values
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    const r = result.rows[0];
    return NextResponse.json({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      order_index: r.order_index,
      orderIndex: r.order_index,
    });
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
    console.error('Error updating category:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update category' },
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
    const result = await query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete category' },
      { status: 500 }
    );
  }
}
