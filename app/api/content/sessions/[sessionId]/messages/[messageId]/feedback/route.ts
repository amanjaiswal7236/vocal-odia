import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { query } from '@/lib/db';

/**
 * PATCH: Set thumbs up/down and optional reason for a message.
 * Body: { feedback: 'up' | 'down', reason?: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; messageId: string }> }
) {
  try {
    const user = requireAuth(req);
    const { sessionId, messageId } = await params;
    const body = await req.json();
    const feedback = body?.feedback;
    const reason = body?.reason ?? null;

    if (feedback !== 'up' && feedback !== 'down') {
      return NextResponse.json(
        { error: 'feedback must be "up" or "down"' },
        { status: 400 }
      );
    }

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

    const messageCheck = await query(
      `SELECT id FROM conversation_messages WHERE id = $1 AND session_id = $2`,
      [parseInt(messageId), parseInt(sessionId)]
    );
    if (messageCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    await query(
      `UPDATE conversation_messages SET feedback = $1, feedback_reason = $2 WHERE id = $3 AND session_id = $4`,
      [feedback, reason && String(reason).trim() ? String(reason).trim() : null, parseInt(messageId), parseInt(sessionId)]
    );

    return NextResponse.json({ success: true, feedback, reason: reason && String(reason).trim() ? String(reason).trim() : null });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('Error updating message feedback:', error);
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
  }
}
