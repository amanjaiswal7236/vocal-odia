import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';
import { generateSasToken } from '@/lib/services/azureBlobService';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = requireAuth(req);
    const { userId: userIdParam } = await params;
    const userId = parseInt(userIdParam);
    
    // Only admin can view any user's sessions, or users can view their own
    if (user.role !== 'admin' && user.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    // Get user sessions
    const result = await query(`
      SELECT 
        id,
        scenario_id,
        scenario_title,
        is_course_lesson,
        course_id,
        tokens_used,
        duration_seconds,
        started_at,
        ended_at,
        session_audio_url
      FROM user_sessions
      WHERE user_id = $1
      ORDER BY started_at DESC
      LIMIT 100
    `, [userId]);
    
    // Map sessions and generate SAS tokens for audio URLs
    const sessions = await Promise.all(result.rows.map(async (row: any) => {
      let sessionAudioUrl = row.session_audio_url || null;
      
      // If session audio URL exists, try to generate a SAS token for it
      if (sessionAudioUrl) {
        try {
          // Extract blob name from URL
          const urlParts = sessionAudioUrl.split('/');
          if (urlParts.length >= 5) {
            const blobName = urlParts.slice(4).join('/');
            const sasUrl = await generateSasToken(blobName, 24);
            if (sasUrl) {
              sessionAudioUrl = sasUrl;
            }
          }
        } catch (err) {
          console.error(`Error generating SAS token for session ${row.id}:`, err);
          // Keep original URL if SAS token generation fails
        }
      }
      
      return {
        id: row.id.toString(),
        scenarioId: row.scenario_id,
        scenarioTitle: row.scenario_title || 'Unknown',
        isCourseLesson: row.is_course_lesson || false,
        courseId: row.course_id,
        tokensUsed: parseInt(row.tokens_used) || 0,
        durationSeconds: parseInt(row.duration_seconds) || 0,
        startedAt: new Date(row.started_at).getTime(),
        endedAt: row.ended_at ? new Date(row.ended_at).getTime() : null,
        sessionAudioUrl: sessionAudioUrl
      };
    }));
    
    return NextResponse.json(sessions);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Error fetching user sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user sessions' },
      { status: 500 }
    );
  }
}
