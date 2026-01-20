import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { query } from '@/lib/db';
import { detectLanguage, shouldFlagMessage } from '@/lib/services/languageDetectionService';

/**
 * Create a single message in the database immediately
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = requireAuth(req);
    const { sessionId } = await params;
    const { text, sender, timestamp } = await req.json();

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

    // Detect language for user messages only
    let detectedLanguage = null;
    let isFlagged = false;
    
    if (sender === 'user' && text && text.trim().length > 0) {
      try {
        const detection = await detectLanguage(text);
        detectedLanguage = detection.language;
        isFlagged = shouldFlagMessage(detection.language);
      } catch (error) {
        console.error('Error detecting language:', error);
        // Continue without language detection if it fails
      }
    }

    // Insert message with language detection data
    const result = await query(`
      INSERT INTO conversation_messages (session_id, text, sender, timestamp, detected_language, is_flagged)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      parseInt(sessionId),
      text || '',
      sender || 'user',
      timestamp || Date.now(),
      detectedLanguage,
      isFlagged
    ]);

    return NextResponse.json({ 
      success: true, 
      messageId: result.rows[0].id,
      detectedLanguage: detectedLanguage,
      isFlagged: isFlagged
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Error creating message:', error);
    return NextResponse.json(
      { error: 'Failed to create message' },
      { status: 500 }
    );
  }
}
