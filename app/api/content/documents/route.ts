import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';

/**
 * GET /api/content/documents – list all documents for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req);

    const result = await query(
      `SELECT id, title, paragraphs, created_at, updated_at
       FROM user_documents
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [user.userId]
    );

    const documents = result.rows.map((row) => ({
      id: String(row.id),
      title: row.title,
      paragraphs: Array.isArray(row.paragraphs) ? row.paragraphs : (row.paragraphs ? JSON.parse(row.paragraphs) : []),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json(documents);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error listing documents:', error);
    return NextResponse.json(
      { error: 'Failed to list documents' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/content/documents – create a new document
 */
export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const body = await req.json();
    const title = (body.title as string) || 'Untitled Document';
    const paragraphs = Array.isArray(body.paragraphs) ? body.paragraphs : [];

    const result = await query(
      `INSERT INTO user_documents (user_id, title, paragraphs)
       VALUES ($1, $2, $3)
       RETURNING id, title, paragraphs, created_at, updated_at`,
      [user.userId, title, JSON.stringify(paragraphs)]
    );

    const row = result.rows[0];
    return NextResponse.json({
      id: String(row.id),
      title: row.title,
      paragraphs: Array.isArray(row.paragraphs) ? row.paragraphs : (row.paragraphs ? JSON.parse(row.paragraphs) : []),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating document:', error);
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    );
  }
}
