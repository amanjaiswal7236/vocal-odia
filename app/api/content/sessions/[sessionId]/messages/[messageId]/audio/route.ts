import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { query } from '@/lib/db';

/**
 * Update message audio URL by messageId
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; messageId: string }> }
) {
  try {
    const user = requireAuth(req);
    const { sessionId, messageId } = await params;
    const { audioUrl } = await req.json();

    // Verify session belongs to user
    const sessionCheck = await query(
      `SELECT user_id FROM user_sessions WHERE id = $1`,
      [parseInt(sessionId)]
    );

    if (sessionCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionUserId = sessionCheck.rows[0].user_id;
    if (user.role !== 'admin' && user.userId !== sessionUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Verify message belongs to session
    const messageCheck = await query(
      `SELECT id FROM conversation_messages WHERE id = $1 AND session_id = $2`,
      [parseInt(messageId), parseInt(sessionId)]
    );

    if (messageCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Update message with audio URL
    await query(
      `UPDATE conversation_messages SET audio_url = $1 WHERE id = $2`,
      [audioUrl, parseInt(messageId)]
    );

    return NextResponse.json({ success: true, messageId: parseInt(messageId) });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Error updating message audio:', error);
    return NextResponse.json({ error: 'Failed to update message audio' }, { status: 500 });
  }
}
