import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';

/**
 * Update an existing session with final data (tokens, duration, messages)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = requireAuth(req);
    const { sessionId } = await params;
    const { tokensUsed, durationSeconds, messages, sessionAudioUrl } = await req.json();
    
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

    // Update session with final data
    const updateFields = ['tokens_used = $1', 'duration_seconds = $2', 'ended_at = NOW()'];
    const updateValues: any[] = [tokensUsed || 0, durationSeconds || 0];
    let paramIndex = 3;
    
    if (sessionAudioUrl) {
      updateFields.push(`session_audio_url = $${paramIndex}`);
      updateValues.push(sessionAudioUrl);
      paramIndex++;
    }
    
    await query(`
      UPDATE user_sessions 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
    `, [...updateValues, parseInt(sessionId)]);

    // Save conversation messages if provided
    // Preserve existing audio URLs by fetching them first, then updating/inserting
    if (messages && Array.isArray(messages) && messages.length > 0) {
      // Get existing messages with their audio URLs
      const existingMessages = await query(`
        SELECT id, text, sender, timestamp, audio_url
        FROM conversation_messages
        WHERE session_id = $1
        ORDER BY timestamp ASC
      `, [parseInt(sessionId)]);
      
      // Create a map of existing audio URLs by timestamp and sender (for matching)
      const existingAudioUrls = new Map<string, string | null>();
      existingMessages.rows.forEach((row: any) => {
        if (row.audio_url) {
          // Use timestamp and sender as key for matching
          const key = `${row.timestamp}_${row.sender}`;
          existingAudioUrls.set(key, row.audio_url);
        }
      });
      
      // Delete existing messages for this session
      await query(`
        DELETE FROM conversation_messages WHERE session_id = $1
      `, [parseInt(sessionId)]);
      
      // Insert all messages with preserved audio URLs
      for (const message of messages) {
        const timestamp = message.timestamp || Date.now();
        const sender = message.sender || 'user';
        const key = `${timestamp}_${sender}`;
        
        // Use audioUrl from message if provided, otherwise try to match from existing
        const audioUrl = message.audioUrl || existingAudioUrls.get(key) || null;
        
        try {
          await query(`
            INSERT INTO conversation_messages (session_id, text, sender, timestamp, audio_url)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            parseInt(sessionId),
            message.text || '',
            sender,
            timestamp,
            audioUrl
          ]);
        } catch (err: any) {
          console.error(`Error inserting message for session ${sessionId}:`, err);
          // Continue with next message even if one fails
        }
      }
      console.log(`Saved ${messages.length} messages for session ${sessionId}`);
    }

    // Update user's token and session count
    await query(`
      UPDATE users 
      SET tokens = tokens + $1, 
          sessions = sessions + 1,
          last_active = EXTRACT(EPOCH FROM NOW()) * 1000
      WHERE id = $2
    `, [tokensUsed || 0, user.userId]);
    
    return NextResponse.json({ success: true, sessionId: parseInt(sessionId) });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Error updating session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}
