import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { query } from '@/lib/db';
import { generateSasToken } from '@/lib/services/azureBlobService';

/**
 * Get a SAS token URL for the session audio
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = requireAuth(req);
    const { sessionId } = await params;

    // Verify session belongs to user
    const sessionCheck = await query(
      `SELECT user_id, session_audio_url FROM user_sessions WHERE id = $1`,
      [parseInt(sessionId)]
    );

    if (sessionCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionUserId = sessionCheck.rows[0].user_id;
    const sessionAudioUrl = sessionCheck.rows[0].session_audio_url;

    if (user.role !== 'admin' && user.userId !== sessionUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!sessionAudioUrl) {
      return NextResponse.json({ error: 'No audio URL found' }, { status: 404 });
    }

    // Extract blob name from URL
    // URL format: https://account.blob.core.windows.net/container/blob-name
    const urlParts = sessionAudioUrl.split('/');
    const blobName = urlParts.slice(4).join('/'); // Everything after /container/

    // Generate SAS token (valid for 24 hours)
    const sasUrl = await generateSasToken(blobName, 24);

    if (!sasUrl) {
      // If SAS token generation fails, return the original URL (might work if container allows public read)
      return NextResponse.json({ audioUrl: sessionAudioUrl });
    }

    return NextResponse.json({ audioUrl: sasUrl });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Error generating SAS token for session audio:', error);
    return NextResponse.json(
      { error: 'Failed to generate audio URL' },
      { status: 500 }
    );
  }
}
