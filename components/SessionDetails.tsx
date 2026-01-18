'use client';

import React, { useState, useEffect } from 'react';
import { UserSession, TranscriptionItem } from '@/types';
import { contentService } from '@/lib/services/contentService';
import { useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/errorHandler';
import LoadingSpinner from '@/components/LoadingSpinner';

interface SessionDetailsProps {
  session: UserSession;
  onBack: () => void;
}

const SessionDetails: React.FC<SessionDetailsProps> = ({ session, onBack }) => {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<TranscriptionItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);
  const audioRefs = React.useRef<Map<number, HTMLAudioElement>>(new Map());
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} seconds`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (secs === 0) return `${mins} minute${mins !== 1 ? 's' : ''}`;
    return `${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;
  };

  useEffect(() => {
    loadMessages();
  }, [session.id]);

  const loadMessages = async () => {
    try {
      setLoadingMessages(true);
      // Messages API now returns SAS token URLs directly
      const data = await contentService.getSessionMessages(parseInt(session.id));
      setMessages(data);
      console.log('Loaded messages:', data.length, 'messages with audio URLs');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setLoadingMessages(false);
    }
  };

  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleMessageClick = (index: number, message: TranscriptionItem) => {
    if (!message.audioUrl) return;

    const audio = audioRefs.current.get(index);
    if (audio) {
      if (playingAudioIndex === index && !audio.paused) {
        // Pause if currently playing
        audio.pause();
        setPlayingAudioIndex(null);
      } else {
        // Stop any currently playing audio
        if (playingAudioIndex !== null) {
          const currentAudio = audioRefs.current.get(playingAudioIndex);
          if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
          }
        }
        // Play the clicked message audio
        audio.currentTime = 0;
        audio.play();
        setPlayingAudioIndex(index);
      }
    }
  };

  const handleAudioEnded = (index: number) => {
    setPlayingAudioIndex(null);
  };

  const handleAudioPause = (index: number) => {
    if (playingAudioIndex === index) {
      setPlayingAudioIndex(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in zoom-in duration-300">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-colors">
          <i className="fas fa-arrow-left text-gray-600"></i>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-black text-gray-900">Session Details</h1>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4 pb-6 border-b border-gray-100">
          <div className="w-16 h-16 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
            <i className={`fas ${session.isCourseLesson ? 'fa-book' : 'fa-comments'} text-2xl`}></i>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{session.scenarioTitle}</h2>
            {session.isCourseLesson && (
              <span className="inline-block px-3 py-1 rounded-full bg-green-50 text-green-600 text-sm font-medium">
                Course Lesson
              </span>
            )}
          </div>
        </div>

        {/* Session Information */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <i className="fas fa-calendar text-green-600"></i>
              <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Started</h3>
            </div>
            <p className="text-gray-700 font-medium">{formatDate(session.startedAt)}</p>
          </div>

          {session.endedAt && (
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <i className="fas fa-calendar-check text-green-600"></i>
                <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Ended</h3>
              </div>
              <p className="text-gray-700 font-medium">{formatDate(session.endedAt)}</p>
            </div>
          )}

          {session.durationSeconds > 0 && (
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <i className="fas fa-clock text-green-600"></i>
                <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Duration</h3>
              </div>
              <p className="text-gray-700 font-medium">{formatDuration(session.durationSeconds)}</p>
            </div>
          )}

          {session.tokensUsed > 0 && (
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <i className="fas fa-coins text-green-600"></i>
                <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Tokens Used</h3>
              </div>
              <p className="text-gray-700 font-medium">{session.tokensUsed.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Additional Details
        <div className="pt-6 border-t border-gray-100 space-y-4">
          {session.scenarioId && (
            <div className="flex items-center justify-between py-3">
              <span className="text-sm font-medium text-gray-600">Scenario ID</span>
              <span className="text-sm font-mono text-gray-900 bg-gray-50 px-3 py-1 rounded-lg">{session.scenarioId}</span>
            </div>
          )}
          
          {session.courseId && (
            <div className="flex items-center justify-between py-3">
              <span className="text-sm font-medium text-gray-600">Course ID</span>
              <span className="text-sm font-mono text-gray-900 bg-gray-50 px-3 py-1 rounded-lg">{session.courseId}</span>
            </div>
          )}

          <div className="flex items-center justify-between py-3">
            <span className="text-sm font-medium text-gray-600">Session ID</span>
            <span className="text-sm font-mono text-gray-900 bg-gray-50 px-3 py-1 rounded-lg">{session.id}</span>
          </div>
        </div> */}

        {/* Status Badge */}
        <div className="pt-6 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${session.endedAt ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
            <span className="text-sm font-medium text-gray-700">
              {session.endedAt ? 'Session Completed' : 'Session Active'}
            </span>
          </div>
        </div>
      </div>

      {/* Session Audio Player */}
      {session.sessionAudioUrl && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-2xl border border-indigo-100">
          <div className="flex items-center gap-3 mb-3">
            <i className="fas fa-headphones text-indigo-600 text-xl"></i>
            <h3 className="font-bold text-indigo-900">Full Session Audio</h3>
          </div>
          <audio 
            controls 
            src={session.sessionAudioUrl}
            className="w-full mt-2"
            preload="metadata"
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {/* Conversation Section */}
      <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <i className="fas fa-comments text-green-600"></i>
          Conversation
        </h2>
        
        {loadingMessages ? (
          <div className="py-12 text-center">
            <LoadingSpinner text="Loading conversation..." />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center">
            <i className="fas fa-comment-slash text-4xl text-gray-300 mb-4"></i>
            <p className="text-gray-500 font-medium">No conversation recorded for this session</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-4 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.sender === 'ai' && (
                  <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-robot text-sm"></i>
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 transition-all ${
                    message.sender === 'user'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  } ${
                    message.audioUrl 
                      ? 'cursor-pointer hover:shadow-lg transform hover:scale-[1.02]' 
                      : ''
                  } ${
                    playingAudioIndex === index 
                      ? message.sender === 'user' 
                        ? 'ring-2 ring-green-300 ring-offset-2' 
                        : 'ring-2 ring-green-400 ring-offset-2'
                      : ''
                  }`}
                  onClick={() => handleMessageClick(index, message)}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                      <p
                        className={`text-xs mt-2 ${
                          message.sender === 'user' ? 'text-green-200' : 'text-gray-500'
                        }`}
                      >
                        {formatMessageTime(message.timestamp)}
                      </p>
                    </div>
                    {message.audioUrl && (
                      <div className={`flex-shrink-0 ml-2 ${
                        message.sender === 'user' ? 'text-green-200' : 'text-gray-600'
                      }`}>
                        {playingAudioIndex === index ? (
                          <i className="fas fa-pause text-lg animate-pulse"></i>
                        ) : (
                          <i className="fas fa-play text-lg"></i>
                        )}
                      </div>
                    )}
                  </div>
                  {message.audioUrl && (
                    <audio 
                      ref={(audio) => {
                        if (audio) {
                          audioRefs.current.set(index, audio);
                          audio.addEventListener('ended', () => handleAudioEnded(index));
                          audio.addEventListener('pause', () => handleAudioPause(index));
                        } else {
                          audioRefs.current.delete(index);
                        }
                      }}
                      src={message.audioUrl}
                      preload="metadata"
                      className="hidden"
                    />
                  )}
                </div>
                {message.sender === 'user' && (
                  <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-user text-sm"></i>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Back Button */}
      <div className="flex justify-center">
        <button
          onClick={onBack}
          className="bg-green-600 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:bg-green-700 transition-all flex items-center gap-2"
        >
          <i className="fas fa-arrow-left"></i>
          Back to Sessions
        </button>
      </div>
    </div>
  );
};

export default SessionDetails;
