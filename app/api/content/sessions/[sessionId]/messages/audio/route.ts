import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { uploadMessageAudio } from '@/lib/services/audioRecordingService';
import { query } from '@/lib/db';

/**
 * Upload audio for a message
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = requireAuth(req);
    const { sessionId } = await params;
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const sender = formData.get('sender') as string;
    const messageIndex = formData.get('messageIndex') as string;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    if (!sender || (sender !== 'user' && sender !== 'ai')) {
      return NextResponse.json({ error: 'Invalid sender. Must be "user" or "ai"' }, { status: 400 });
    }

    if (!messageIndex) {
      return NextResponse.json({ error: 'Message index is required' }, { status: 400 });
    }

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

    // Convert File to Blob
    const audioBlob = new Blob([await audioFile.arrayBuffer()], { type: audioFile.type });
    
    // Upload to Azure (server-side)
    const audioUrl = await uploadMessageAudio(
      parseInt(sessionId),
      audioBlob,
      sender as 'user' | 'ai',
      parseInt(messageIndex)
    );

    if (!audioUrl) {
      return NextResponse.json({ error: 'Failed to upload audio to Azure' }, { status: 500 });
    }

    return NextResponse.json({ success: true, audioUrl });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Error uploading message audio:', error);
    return NextResponse.json({ error: 'Failed to upload audio' }, { status: 500 });
  }
}
