'use client';

import React, { useState, useEffect } from 'react';
import { UserSession } from '@/types';
import { contentService } from '@/lib/services/contentService';
import { useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/errorHandler';
import EmptyState from '@/components/EmptyState';
import LoadingSpinner from '@/components/LoadingSpinner';

interface SessionsListProps {
  userId: number;
  onBack: () => void;
  onSelectSession: (session: UserSession) => void;
}

const SessionsList: React.FC<SessionsListProps> = ({ userId, onBack, onSelectSession }) => {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, [userId]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await contentService.getUserSessions(userId);
      setSessions(data);
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl p-10 shadow-xl border border-gray-100 text-center">
          <LoadingSpinner text="Loading your sessions..." />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in zoom-in duration-300">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-colors">
          <i className="fas fa-arrow-left text-gray-600"></i>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-black text-gray-900">Past Sessions</h1>
          <p className="text-sm text-gray-500 mt-1">View and review your learning history</p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 shadow-xl border border-gray-100">
          <EmptyState
            icon="fa-history"
            title="No sessions yet"
            description="Your completed sessions will appear here"
            action={{ label: "Go Back", onClick: onBack }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session)}
              className="w-full bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-green-200 text-left transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors">
                      <i className={`fas ${session.isCourseLesson ? 'fa-book' : 'fa-comments'} text-sm`}></i>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 group-hover:text-green-600 transition-colors">
                        {session.scenarioTitle}
                      </h3>
                      {session.isCourseLesson && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-xs font-medium">
                          Course Lesson
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <i className="fas fa-calendar text-gray-400"></i>
                      <span>{formatDate(session.startedAt)}</span>
                    </div>
                    {session.durationSeconds > 0 && (
                      <div className="flex items-center gap-2">
                        <i className="fas fa-clock text-gray-400"></i>
                        <span>{formatDuration(session.durationSeconds)}</span>
                      </div>
                    )}
                    {session.tokensUsed > 0 && (
                      <div className="flex items-center gap-2">
                        <i className="fas fa-coins text-gray-400"></i>
                        <span>{session.tokensUsed.toLocaleString()} tokens</span>
                      </div>
                    )}
                  </div>
                </div>
                <i className="fas fa-chevron-right text-gray-400 group-hover:text-green-600 transition-colors"></i>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SessionsList;
