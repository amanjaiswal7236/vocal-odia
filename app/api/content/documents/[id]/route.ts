import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';

function parseParagraphs(paragraphs: unknown): string[] {
  if (Array.isArray(paragraphs)) {
    return paragraphs.filter((p): p is string => typeof p === 'string');
  }
  return [];
}

/**
 * GET /api/content/documents/[id] – get one document (must belong to user)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(req);
    const { id } = await params;
    const docId = parseInt(id, 10);
    if (Number.isNaN(docId)) {
      return NextResponse.json({ error: 'Invalid document id' }, { status: 400 });
    }

    const result = await query(
      `SELECT id, title, paragraphs, created_at, updated_at
       FROM user_documents
       WHERE id = $1 AND user_id = $2`,
      [docId, user.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const row = result.rows[0];
    return NextResponse.json({
      id: String(row.id),
      title: row.title,
      paragraphs: parseParagraphs(row.paragraphs),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error getting document:', error);
    return NextResponse.json(
      { error: 'Failed to get document' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/content/documents/[id] – update document (title and/or paragraphs)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(req);
    const { id } = await params;
    const docId = parseInt(id, 10);
    if (Number.isNaN(docId)) {
      return NextResponse.json({ error: 'Invalid document id' }, { status: 400 });
    }

    const body = await req.json();
    const title = body.title as string | undefined;
    const paragraphs = body.paragraphs;

    // Build dynamic update
    const updates: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (typeof title === 'string') {
      updates.push(`title = $${paramIndex}`);
      values.push(title);
      paramIndex++;
    }
    if (paragraphs !== undefined) {
      const arr = parseParagraphs(paragraphs);
      updates.push(`paragraphs = $${paramIndex}`);
      values.push(JSON.stringify(arr));
      paramIndex++;
    }

    if (paramIndex === 1) {
      return NextResponse.json({ error: 'Provide title and/or paragraphs to update' }, { status: 400 });
    }

    values.push(docId, user.userId);
    const result = await query(
      `UPDATE user_documents
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING id, title, paragraphs, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const row = result.rows[0];
    return NextResponse.json({
      id: String(row.id),
      title: row.title,
      paragraphs: parseParagraphs(row.paragraphs),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating document:', error);
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/content/documents/[id] – delete document (must belong to user)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(req);
    const { id } = await params;
    const docId = parseInt(id, 10);
    if (Number.isNaN(docId)) {
      return NextResponse.json({ error: 'Invalid document id' }, { status: 400 });
    }

    const result = await query(
      `DELETE FROM user_documents WHERE id = $1 AND user_id = $2 RETURNING id`,
      [docId, user.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
