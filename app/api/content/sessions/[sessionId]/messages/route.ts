import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';
import { generateSasToken } from '@/lib/services/azureBlobService';
import { detectLanguage, shouldFlagMessage } from '@/lib/services/languageDetectionService';
import { uploadMessageAudio } from '@/lib/services/audioRecordingService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = requireAuth(req);
    const { sessionId } = await params;
    const contentType = req.headers.get('content-type') || '';

    // Branch: FormData with 'audio' → message audio upload; JSON → create message
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const audioFile = formData.get('audio') as File | null;
      if (audioFile != null && typeof (audioFile as File).size === 'number') {
        const file = audioFile as File;
        if (file.size === 0) {
          return NextResponse.json({ error: 'Audio file is empty' }, { status: 400 });
        }
        const sender = (formData.get('sender') as string) || '';
        const messageIndex = (formData.get('messageIndex') as string) || '';
        if (sender !== 'user' && sender !== 'ai') {
          return NextResponse.json({ error: 'Invalid sender. Must be "user" or "ai"' }, { status: 400 });
        }
        const idx = parseInt(messageIndex, 10);
        if (!messageIndex || isNaN(idx) || idx < 0) {
          return NextResponse.json({ error: 'Message index is required and must be a non-negative integer' }, { status: 400 });
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
        const audioBlob = new Blob([await file.arrayBuffer()], { type: file.type || 'audio/webm' });
        const audioUrl = await uploadMessageAudio(
          parseInt(sessionId, 10),
          audioBlob,
          sender as 'user' | 'ai',
          idx
        );
        if (!audioUrl) {
          return NextResponse.json({ error: 'Failed to upload audio to Azure' }, { status: 500 });
        }
        return NextResponse.json({ success: true, audioUrl });
      }
    }

    // JSON body → create message
    const body = await req.json();
    const { text, sender, timestamp } = body || {};
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
    let detectedLanguage: string | null = null;
    let isFlagged = false;
    if (sender === 'user' && text && String(text).trim().length > 0) {
      try {
        const detection = await detectLanguage(String(text));
        detectedLanguage = detection.language;
        isFlagged = shouldFlagMessage(detection.language);
      } catch (e) {
        console.error('Error detecting language:', e);
      }
    }
    const result = await query(
      `INSERT INTO conversation_messages (session_id, text, sender, timestamp, detected_language, is_flagged)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        parseInt(sessionId),
        text || '',
        sender || 'user',
        timestamp ?? Date.now(),
        detectedLanguage,
        isFlagged,
      ]
    );
    return NextResponse.json({
      success: true,
      messageId: result.rows[0].id,
      detectedLanguage,
      isFlagged,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('Error in messages POST:', error);
    return NextResponse.json(
      { error: 'Failed to create message or upload audio' },
      { status: 500 }
    );
  }
}

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
        audio_url,
        detected_language,
        is_flagged,
        feedback,
        feedback_reason,
        created_at
      FROM conversation_messages
      WHERE session_id = $1
      ORDER BY timestamp ASC
    `, [sessionId]);
    
    // Map messages and generate SAS tokens for audio URLs
    const messages = await Promise.all(result.rows.map(async (row: any) => {
      let audioUrl = row.audio_url || null;
      
      // If audio URL exists, try to generate a SAS token for it
      if (audioUrl) {
        try {
          // Extract blob name from URL
          // URL format: https://account.blob.core.windows.net/container/blob-name
          const urlParts = audioUrl.split('/');
          if (urlParts.length >= 5) {
            const blobName = urlParts.slice(4).join('/');
            const sasUrl = await generateSasToken(blobName, 24);
            if (sasUrl) {
              audioUrl = sasUrl;
            }
          }
        } catch (err) {
          console.error(`Error generating SAS token for message ${row.id}:`, err);
          // Keep original URL if SAS token generation fails
        }
      }
      
      const message: any = {
        id: row.id.toString(),
        text: row.text,
        sender: row.sender,
        timestamp: parseInt(row.timestamp) || new Date(row.created_at).getTime(),
        audioUrl: audioUrl,
        feedback: row.feedback || null,
        feedbackReason: row.feedback_reason || null
      };
      
      // Only include language detection data for admins
      if (user.role === 'admin') {
        message.detectedLanguage = row.detected_language || null;
        message.isFlagged = row.is_flagged || false;
      }
      
      return message;
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
