import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { query } from '@/lib/db';
import { generateSasToken } from '@/lib/services/azureBlobService';

/**
 * Get a SAS token URL for a message audio
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; messageId: string }> }
) {
  try {
    const user = requireAuth(req);
    const { sessionId, messageId } = await params;

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

    // Get message audio URL
    const messageCheck = await query(
      `SELECT audio_url FROM conversation_messages WHERE id = $1 AND session_id = $2`,
      [parseInt(messageId), parseInt(sessionId)]
    );

    if (messageCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const audioUrl = messageCheck.rows[0].audio_url;

    if (!audioUrl) {
      return NextResponse.json({ error: 'No audio URL found' }, { status: 404 });
    }

    // Extract blob name from URL
    const urlParts = audioUrl.split('/');
    const blobName = urlParts.slice(4).join('/');

    // Generate SAS token (valid for 24 hours)
    const sasUrl = await generateSasToken(blobName, 24);

    if (!sasUrl) {
      // If SAS token generation fails, return the original URL
      return NextResponse.json({ audioUrl: audioUrl });
    }

    return NextResponse.json({ audioUrl: sasUrl });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Error generating SAS token for message audio:', error);
    return NextResponse.json(
      { error: 'Failed to generate audio URL' },
      { status: 500 }
    );
  }
}
