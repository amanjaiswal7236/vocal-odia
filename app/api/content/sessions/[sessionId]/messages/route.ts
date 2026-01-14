import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = requireAuth(req);
    const { sessionId: sessionIdParam } = await params;
    const sessionId = parseInt(sessionIdParam);
    
    // First, verify the session belongs to the user (or user is admin)
    const sessionCheck = await query(`
      SELECT user_id FROM user_sessions WHERE id = $1
    `, [sessionId]);
    
    if (sessionCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }
    
    const sessionUserId = sessionCheck.rows[0].user_id;
    
    // Only admin can view any user's sessions, or users can view their own
    if (user.role !== 'admin' && user.userId !== sessionUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    // Get conversation messages for the session
    const result = await query(`
      SELECT 
        id,
        text,
        sender,
        timestamp,
        created_at
      FROM conversation_messages
      WHERE session_id = $1
      ORDER BY timestamp ASC
    `, [sessionId]);
    
    const messages = result.rows.map((row: any) => ({
      id: row.id.toString(),
      text: row.text,
      sender: row.sender,
      timestamp: parseInt(row.timestamp) || new Date(row.created_at).getTime()
    }));
    
    return NextResponse.json(messages);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Error fetching session messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session messages' },
      { status: 500 }
    );
  }
}
