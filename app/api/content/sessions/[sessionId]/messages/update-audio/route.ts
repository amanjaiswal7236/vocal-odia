import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { query } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = requireAuth(req);
    const { sessionId } = await params;
    const { messageIndex, audioUrl, sender } = await req.json();

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

    // Get messages for this session ordered by timestamp
    const messagesResult = await query(
      `SELECT id FROM conversation_messages 
       WHERE session_id = $1 AND sender = $2 
       ORDER BY timestamp ASC 
       LIMIT 1 OFFSET $3`,
      [parseInt(sessionId), sender, messageIndex]
    );

    if (messagesResult.rows.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const messageId = messagesResult.rows[0].id;

    // Update message with audio URL
    await query(
      `UPDATE conversation_messages SET audio_url = $1 WHERE id = $2`,
      [audioUrl, messageId]
    );

    return NextResponse.json({ success: true, messageId });
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
