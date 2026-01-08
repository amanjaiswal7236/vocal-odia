'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { SYSTEM_INSTRUCTION } from '@/lib/constants';
import { Scenario, TranscriptionItem } from '@/types';
import { decode, decodeAudioData, createBlob } from '@/lib/utils/audioUtils';
import VoiceVisualizer from './VoiceVisualizer';
import { useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/errorHandler';

interface LiveSessionProps {
  scenario: Scenario;
  onEnd: (estimatedTokens?: number) => void;
}

const LiveSession: React.FC<LiveSessionProps> = ({ scenario, onEnd }) => {
  const { showToast } = useToast();
  const [isReady, setIsReady] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [transcriptions, setTranscriptions] = useState<TranscriptionItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Audio Contexts
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  
  // Audio Scheduling Refs
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const processingQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Session & Stream Refs
  const sessionRef = useRef<any>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Data Tracking
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');
  const totalCharsTracked = useRef(0);

  const initializeAudio = async () => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch (e) {
      const errorMessage = 'Microphone access denied. Please check your browser permissions.';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      return false;
    }
  };

  const startSession = useCallback(async () => {
    const audioReady = await initializeAudio();
    if (!audioReady) return;

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      setError('Gemini API key is not configured.');
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025', // Ensure you are using a valid live-enabled model
        callbacks: {
          onopen: () => {
            console.log('AI session opened');
            setIsReady(true);
            setError(null);
            
            try {
              const source = audioContextRef.current!.createMediaStreamSource(streamRef.current!);
              scriptProcessorRef.current = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
              
              scriptProcessorRef.current.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                
                // Simple VAD for visualizer
                const volume = inputData.reduce((acc, v) => acc + Math.abs(v), 0) / inputData.length;
                setIsUserSpeaking(volume > 0.01);

                sessionPromise.then((session) => {
                  if (session?.sendRealtimeInput) {
                    session.sendRealtimeInput({ media: pcmBlob });
                  }
                });
              };

              source.connect(scriptProcessorRef.current);
              scriptProcessorRef.current.connect(audioContextRef.current!.destination);
            } catch (err) {
              console.error('Mic setup error:', err);
            }
          },

          onmessage: async (message: LiveServerMessage) => {
            // 1. SEQUENTIAL AUDIO PROCESSING
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              processingQueueRef.current = processingQueueRef.current.then(async () => {
                try {
                  const ctx = outputAudioContextRef.current;
                  if (!ctx) return;
                  if (ctx.state === 'suspended') await ctx.resume();

                  setIsAiSpeaking(true);
                  const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                  
                  const source = ctx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(ctx.destination);

                  const startTime = Math.max(nextStartTimeRef.current, ctx.currentTime);
                  
                  source.onended = () => {
                    sourcesRef.current.delete(source);
                    if (sourcesRef.current.size === 0) setIsAiSpeaking(false);
                  };

                  source.start(startTime);
                  nextStartTimeRef.current = startTime + audioBuffer.duration;
                  sourcesRef.current.add(source);
                } catch (err) {
                  console.error('Audio playback error:', err);
                }
              });
            }

            // 2. TRANSCRIPTION LOGIC
            const outputText = message.serverContent?.outputTranscription?.text;
            if (outputText) {
              currentOutputTranscription.current += outputText;
              totalCharsTracked.current += outputText.length;
            }
            
            const inputText = message.serverContent?.inputTranscription?.text;
            if (inputText) {
              currentInputTranscription.current += inputText;
              totalCharsTracked.current += inputText.length;
            }

            if (message.serverContent?.turnComplete) {
              if (currentInputTranscription.current) {
                setTranscriptions(prev => [...prev, { text: currentInputTranscription.current, sender: 'user', timestamp: Date.now() }]);
                currentInputTranscription.current = '';
              }
              if (currentOutputTranscription.current) {
                setTranscriptions(prev => [...prev, { text: currentOutputTranscription.current, sender: 'ai', timestamp: Date.now() }]);
                currentOutputTranscription.current = '';
              }
            }

            // 3. INTERRUPTION LOGIC
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = outputAudioContextRef.current?.currentTime || 0;
              processingQueueRef.current = Promise.resolve(); // Clear queue
              setIsAiSpeaking(false);
            }
          },

          onerror: (e) => {
            console.error('Session error:', e);
            setError('Conversation interrupted. Please try again.');
            setIsReady(false);
          },
          
          onclose: () => setIsReady(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `${SYSTEM_INSTRUCTION}\n\nTASK: ${scenario.prompt || scenario.title}`,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }, [scenario, showToast]);

  useEffect(() => {
    startSession();
    return () => {
      sessionRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close();
      outputAudioContextRef.current?.close();
    };
  }, [startSession]);

  const handleEnd = () => {
    const estimatedTokens = Math.ceil(totalCharsTracked.current / 4) + 100;
    onEnd(estimatedTokens);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-in zoom-in duration-300">
      {/* Header */}
      <div className={`p-6 flex justify-between items-center text-white ${scenario.isCourseLesson ? 'bg-gradient-to-r from-green-600 to-teal-700' : 'bg-gradient-to-r from-blue-600 to-indigo-700'}`}>
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded">
            {scenario.isCourseLesson ? 'Course Mode' : 'Scenario Mode'}
          </span>
          <h2 className="text-xl font-bold">{scenario.title}</h2>
        </div>
        <button onClick={handleEnd} className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors flex items-center gap-2 px-4">
          <span className="text-xs font-bold uppercase">Finish</span>
          <i className="fas fa-check"></i>
        </button>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 bg-gray-50/50">
        {!isReady && !error && (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 space-y-4">
            <i className="fas fa-circle-notch fa-spin text-3xl text-blue-600"></i>
            <p className="text-lg">Connecting to AI agent...</p>
          </div>
        )}
        
        {transcriptions.map((t, i) => (
          <div key={i} className={`flex ${t.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${t.sender === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}`}>
              <p className="text-sm font-medium mb-1 opacity-70">{t.sender === 'user' ? 'You' : 'Coach'}</p>
              <p className="leading-relaxed">{t.text}</p>
            </div>
          </div>
        ))}
        {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-center">{error}</div>}
      </div>

      {/* Footer Visualizer */}
      <div className="p-8 border-t bg-white flex flex-col items-center gap-6">
        <div className="flex items-center gap-12">
          <div className="text-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">You</p>
            <VoiceVisualizer isActive={isUserSpeaking} color="bg-blue-400" />
          </div>
          
          <div className="relative">
             <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-lg ${isAiSpeaking ? 'bg-indigo-600' : 'bg-gray-200'} scale-110`}>
                <i className={`fas ${scenario.isCourseLesson ? 'fa-graduation-cap' : 'fa-brain'} text-2xl ${isAiSpeaking ? 'text-white' : 'text-gray-400'}`}></i>
             </div>
             {isAiSpeaking && <div className="absolute -inset-2 border-2 border-indigo-200 rounded-full animate-ping opacity-20"></div>}
          </div>

          <div className="text-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">AI Coach</p>
            <VoiceVisualizer isActive={isAiSpeaking} color="bg-indigo-400" />
          </div>
        </div>
        <p className="text-gray-500 text-sm font-medium italic">
          {!isReady ? "Connecting..." : isAiSpeaking ? "Coach is speaking..." : isUserSpeaking ? "Listening to you..." : "Waiting for your input..."}
        </p>
      </div>
    </div>
  );
};

export default LiveSession;