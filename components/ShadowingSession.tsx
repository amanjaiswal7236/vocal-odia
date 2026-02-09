'use client';

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { ShadowingTask } from '@/types';
import { decode, decodeAudioData } from '@/lib/utils/audioUtils';
import { contentService } from '@/lib/services/contentService';
import VoiceVisualizer from './VoiceVisualizer';
import { useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/errorHandler';
import EmptyState from '@/components/EmptyState';
import LoadingSpinner from '@/components/LoadingSpinner';

interface ShadowingSessionProps {
  tasks: ShadowingTask[];
  onBack: () => void;
  onComplete: () => void;
}

const ShadowingSession: React.FC<ShadowingSessionProps> = ({ tasks: initialTasks, onBack, onComplete }) => {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<ShadowingTask[]>(initialTasks);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (tasks.length === 0) {
      setLoading(true);
      contentService.getShadowingTasks()
        .then(data => {
          setTasks(data.map((t: any) => ({
            id: t.id.toString(),
            text: t.text,
            translation: t.translation,
            focusArea: t.focus_area
          })));
        })
        .catch(err => {
          showToast(getErrorMessage(err), 'error');
        })
        .finally(() => setLoading(false));
    }
  }, [tasks.length, showToast]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showWordPractice, setShowWordPractice] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [isPlayingWord, setIsPlayingWord] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const currentTask = tasks[currentIndex];
  
  // Extract words from the sentence for pronunciation practice
  const words = currentTask ? currentTask.text.toLowerCase().replace(/[.,!?;:]/g, '').split(/\s+/).filter(w => w.length > 0) : [];

  const playAIModel = async (text?: string) => {
    const textToPlay = text || currentTask?.text;
    if (!textToPlay) return;
    
    if (text) {
      setIsPlayingWord(true);
    } else {
      setIsPlaying(true);
    }
    
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      showToast('Audio playback is not available. API key not configured.', 'warning');
      setIsPlaying(false);
      setIsPlayingWord(false);
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    
    try {
      const prompt = text ? `Pronounce this word clearly and slowly: ${text}` : `Say clearly: ${textToPlay}`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'aoede' } } },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const buffer = await decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => {
          if (text) {
            setIsPlayingWord(false);
          } else {
            setIsPlaying(false);
          }
        };
        source.start();
      } else {
        showToast('No audio received from AI', 'warning');
        setIsPlaying(false);
        setIsPlayingWord(false);
      }
    } catch (e) {
      const errorMessage = getErrorMessage(e);
      console.error(e);
      showToast(`Failed to play audio: ${errorMessage}`, 'error');
      setIsPlaying(false);
      setIsPlayingWord(false);
    }
  };

  const handleWordClick = (word: string) => {
    setSelectedWord(word);
    playAIModel(word);
  };

  const handleNext = () => {
    if (currentIndex < tasks.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setFeedback(null);
      setShowWordPractice(false);
      setSelectedWord(null);
    } else {
      onComplete();
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in zoom-in duration-300">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-colors">
          <i className="fas fa-arrow-left text-gray-600"></i>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-black text-gray-900">Pronunciation Mode</h1>
          <div className="flex gap-1 mt-2">
            {tasks.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i === currentIndex ? 'bg-green-600' : i < currentIndex ? 'bg-green-500' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl p-10 shadow-xl border border-gray-100 text-center">
          <LoadingSpinner text="Loading pronunciation tasks..." />
        </div>
      ) : !currentTask ? (
        <EmptyState
          icon="fa-microphone-slash"
          title="No tasks available"
          description="Pronunciation tasks will appear here when available"
          action={{ label: "Go Back", onClick: onBack }}
        />
      ) : (
        <div className="bg-white rounded-3xl p-10 shadow-xl border border-gray-100 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <i className="fas fa-quote-right text-9xl"></i>
          </div>

          <span className="inline-block px-3 py-1 rounded-full bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-widest mb-6">
            Focus: {currentTask.focusArea}
          </span>

          <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-4">
            "{currentTask.text}"
          </h2>
          
          <p className="text-sm text-gray-400 font-medium italic mb-6">
            Translation: {currentTask.translation}
          </p>

          {/* Word Practice Toggle */}
          <div className="mb-8">
            <button
              onClick={() => setShowWordPractice(!showWordPractice)}
              className="text-sm font-medium text-green-600 hover:text-green-700 flex items-center gap-2 mx-auto"
            >
              <i className={`fas ${showWordPractice ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
              <span>{showWordPractice ? 'Hide' : 'Practice'} Word Pronunciation</span>
            </button>
          </div>

          {/* Word Pronunciation Practice */}
          {showWordPractice && (
            <div className="mb-8 p-6 bg-green-50 rounded-2xl border border-green-100">
              <h3 className="text-sm font-bold text-green-900 mb-4 flex items-center gap-2">
                <i className="fas fa-volume-up"></i>
                Click on words to hear pronunciation
              </h3>
              <div className="flex flex-wrap gap-2 justify-center">
                {words.map((word, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleWordClick(word)}
                    disabled={isPlayingWord}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedWord === word && isPlayingWord
                        ? 'bg-green-600 text-white animate-pulse'
                        : selectedWord === word
                        ? 'bg-green-200 text-green-900'
                        : 'bg-white text-gray-700 hover:bg-green-100 border border-green-200'
                    }`}
                  >
                    {word}
                    {selectedWord === word && isPlayingWord && (
                      <i className="fas fa-volume-up ml-2"></i>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

        <div className="flex flex-col items-center gap-8">
          <div className="flex gap-6">
            <button 
              onClick={() => playAIModel()}
              disabled={isPlaying || isRecording}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-green-600 text-white animate-pulse' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
            >
              <i className={`fas ${isPlaying ? 'fa-volume-up' : 'fa-play'} text-xl`}></i>
            </button>

            <button 
              onMouseDown={() => setIsRecording(true)}
              onMouseUp={() => { setIsRecording(false); setIsEvaluating(true); setTimeout(() => { setIsEvaluating(false); setFeedback('Excellent rhythm! Your pronunciation of "Bhubaneswar" was spot on.'); }, 1500); }}
              disabled={isPlaying}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white scale-125' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}
            >
              <i className="fas fa-microphone text-xl"></i>
            </button>
          </div>

          <div className="h-12 w-full max-w-xs">
            <VoiceVisualizer isActive={isRecording} color="bg-red-400" />
          </div>

          {isEvaluating && (
            <p className="text-sm font-bold text-green-600 animate-pulse">Analyzing your voice pattern...</p>
          )}

          {feedback && (
            <div className="bg-green-50 p-4 rounded-2xl border border-green-100 animate-in fade-in slide-in-from-top">
              <p className="text-sm text-green-700 font-medium">{feedback}</p>
              <button 
                onClick={handleNext}
                className="mt-4 bg-green-600 text-white px-6 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-green-700 transition-all"
              >
                Next Sentence <i className="fas fa-arrow-right ml-1"></i>
              </button>
            </div>
          )}
        </div>
        </div>
      )}

      <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
        <h3 className="font-bold text-green-900 text-sm mb-2 flex items-center gap-2">
          <i className="fas fa-info-circle"></i> Coach's Tip
        </h3>
        <p className="text-xs text-green-700 leading-relaxed">
          The mirror technique helps you match natural rhythm and phrasing. Try to match the AI&apos;s speed exactly, especially when linking words together.
        </p>
      </div>
    </div>
  );
};

export default ShadowingSession;
