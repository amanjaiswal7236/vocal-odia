'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { SYSTEM_INSTRUCTION, AI_AGENT } from '@/lib/constants';
import { Scenario, TranscriptionItem } from '@/types';
import { decode, decodeAudioData, createBlob } from '@/lib/utils/audioUtils';
import { encodeAudioBuffersToWav } from '@/lib/utils/audioEncoder';
import { createAudioRecorder, uploadSessionAudio } from '@/lib/services/audioRecordingService';
import VoiceVisualizer from './VoiceVisualizer';
import { useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/errorHandler';

interface LiveSessionProps {
  scenario: Scenario;
  courseId?: string | null;
  onEnd: (estimatedTokens?: number, transcriptions?: TranscriptionItem[], sessionAudioUrl?: string | null, sessionId?: number | null) => void;
}

const LiveSession: React.FC<LiveSessionProps> = ({ scenario, courseId, onEnd }) => {
  const { showToast } = useToast();
  const [isReady, setIsReady] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [transcriptions, setTranscriptions] = useState<TranscriptionItem[]>([]);
  const transcriptionsRef = useRef<TranscriptionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Helper to update both state and ref
  const updateTranscriptions = (updater: (prev: TranscriptionItem[]) => TranscriptionItem[]) => {
    setTranscriptions(prev => {
      const newTranscriptions = updater(prev);
      transcriptionsRef.current = newTranscriptions;
      return newTranscriptions;
    });
  };

  // Save message to database immediately
  const saveMessageToDB = async (text: string, sender: 'user' | 'ai', timestamp: number) => {
    if (!sessionIdRef.current) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await fetch(`/api/content/sessions/${sessionIdRef.current}/messages/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text,
          sender,
          timestamp
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        return result.messageId;
      }
    } catch (err) {
      console.error('Error saving message to DB:', err);
    }
    return null;
  };
  const [showDescription, setShowDescription] = useState(true);
  const [descriptionText, setDescriptionText] = useState<string>('');
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isSpeakingDescription, setIsSpeakingDescription] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [aiHasSpokenFirst, setAiHasSpokenFirst] = useState(false);
  const [isWaitingForAiGreeting, setIsWaitingForAiGreeting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false); // Use ref to avoid stale closures in callbacks
  const descriptionAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const descriptionSpeechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const hasSpokenDescriptionRef = useRef(false);
  const descriptionAudioContextRef = useRef<AudioContext | null>(null); // Separate audio context for description
  const isGeneratingRef = useRef(false); // Additional guard to prevent multiple calls
  const descriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout to ensure button appears
  const micInputEnabledRef = useRef(false); // Control when microphone input is sent
  const isWaitingForAiGreetingRef = useRef(false); // Use ref to avoid stale closures
  const wasMicEnabledBeforePause = useRef(false); // Remember mic state before pause

  // Debug: Log scenario image
  useEffect(() => {
    console.log('LiveSession - Scenario loaded:', {
      title: scenario.title,
      hasImage: !!scenario.image,
      image: scenario.image
    });
  }, [scenario]);

  // Audio Contexts
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  
  // Audio Scheduling Refs
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const processingQueueRef = useRef<Promise<void>>(Promise.resolve());

  // AI Audio State (isolated pipeline)
  // Store raw AudioBuffer objects, not WAV blobs (to avoid multiple WAV headers)
  const aiAudioChunksRef = useRef<AudioBuffer[]>([]);
  const aiSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const aiProcessingQueueRef = useRef<Promise<void>>(Promise.resolve());
  const aiAudioFinishWaitersRef = useRef<Set<() => void>>(new Set());

  // Session & Stream Refs
  const sessionRef = useRef<any>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Audio Recording Refs
  const sessionAudioRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionAudioChunksRef = useRef<Blob[]>([]);
  const sessionAudioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const sessionAudioStreamRef = useRef<MediaStream | null>(null);
  const messageAudioMapRef = useRef<Map<number, { userAudio?: Blob; aiAudio?: Blob }>>(new Map());
  const currentUserAudioChunksRef = useRef<Blob[]>([]);
  const isRecordingUserAudioRef = useRef(false);
  const userAudioRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionStartTimeRef = useRef<number>(Date.now());
  const sessionIdRef = useRef<number | null>(null);

  // Data Tracking
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');
  const totalCharsTracked = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Map to store messageId by message index
  const messageIdMapRef = useRef<Map<number, number>>(new Map());

  const userAudioStopTimeRef = useRef<number | null>(null);

  // AI Audio Pipeline Functions
  const handleAiAudioChunk = (base64Audio: string) => {
    aiProcessingQueueRef.current = aiProcessingQueueRef.current.then(async () => {
      const ctx = outputAudioContextRef.current;
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      setIsAiSpeaking(true);

      const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);

      // Store raw AudioBuffer (not WAV blob) to avoid multiple WAV headers
      // We'll combine all buffers into a single WAV file at the end
      aiAudioChunksRef.current.push(audioBuffer);
      const totalSamples = aiAudioChunksRef.current.reduce((sum, buf) => sum + buf.length, 0);
      const estimatedDuration = totalSamples / 24000; // 24kHz sample rate
      console.log(
        '[AI AUDIO]',
        aiAudioChunksRef.current.length,
        'chunks',
        totalSamples,
        'samples',
        estimatedDuration.toFixed(2),
        'seconds'
      );

      // Playback
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      source.connect(ctx.destination);

      // Also record to session stream
      if (sessionAudioDestinationRef.current) {
        try {
          source.connect(sessionAudioDestinationRef.current);
        } catch (err) {
          console.error('Error connecting AI audio to session recorder:', err);
        }
      }

      source.onended = () => {
        aiSourcesRef.current.delete(source);

        if (aiSourcesRef.current.size === 0) {
          setIsAiSpeaking(false);
          aiAudioFinishWaitersRef.current.forEach(fn => fn());
          aiAudioFinishWaitersRef.current.clear();

          // After AI finishes speaking the first time, enable microphone input
          if (isWaitingForAiGreetingRef.current && !micInputEnabledRef.current) {
            console.log('AI finished speaking - enabling microphone input');
            setIsWaitingForAiGreeting(false);
            isWaitingForAiGreetingRef.current = false;
            micInputEnabledRef.current = true;
          }
        }
      };

      aiSourcesRef.current.add(source);
      const startTime = Math.max(nextStartTimeRef.current, ctx.currentTime);
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;
    });
  };

  const finalizeAiAudio = async (messageIndex: number, messageId?: number) => {
    // Wait for decoding queue
    await aiProcessingQueueRef.current;

    // Wait for playback to finish
    if (aiSourcesRef.current.size > 0) {
      await new Promise<void>(resolve => {
        aiAudioFinishWaitersRef.current.add(resolve);
      });
    }

    // Grace period for late chunks
    await new Promise(r => setTimeout(r, 800));
    await aiProcessingQueueRef.current;

    const audioBuffers = [...aiAudioChunksRef.current];
    if (!audioBuffers.length) {
      console.warn(`[finalizeAiAudio] No AI audio chunks for message ${messageIndex}`);
      return;
    }

    // Combine all AudioBuffers into a single WAV file (single header, no corruption)
    const aiAudioBlob = encodeAudioBuffersToWav(audioBuffers);
    if (!aiAudioBlob) {
      console.error(`[finalizeAiAudio] Failed to combine audio buffers for message ${messageIndex}`);
      aiAudioChunksRef.current = [];
      return;
    }

    const totalSamples = audioBuffers.reduce((sum, buf) => sum + buf.length, 0);
    const durationEstimate = totalSamples / 24000; // 24kHz sample rate
    console.log(
      `[finalizeAiAudio] Created AI audio blob: ${aiAudioBlob.size} bytes, ${audioBuffers.length} buffers combined, ${totalSamples} samples, duration: ${durationEstimate.toFixed(2)}s`
    );

    // IMPORTANT: clear ONLY after successful blob creation
    aiAudioChunksRef.current = [];

    // Upload AI audio
    if (sessionIdRef.current) {
      const token = localStorage.getItem('token');
      if (token) {
        const formData = new FormData();
        formData.append('audio', aiAudioBlob, `ai-message-${messageIndex}.wav`);
        formData.append('sender', 'ai');
        formData.append('messageIndex', messageIndex.toString());

        fetch(`/api/content/sessions/${sessionIdRef.current}/messages/audio`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        })
          .then(async (response) => {
            if (response.ok) {
              const result = await response.json();
              const audioUrl = result.audioUrl;
              if (audioUrl) {
                console.log(`[finalizeAiAudio] AI audio uploaded successfully for message ${messageIndex}:`, audioUrl);
                // Update transcriptions to include audio URL
                updateTranscriptions(prev => {
                  const updated = [...prev];
                  if (updated[messageIndex] && updated[messageIndex].sender === 'ai') {
                    updated[messageIndex] = {
                      ...updated[messageIndex],
                      audioUrl: audioUrl
                    };
                  }
                  return updated;
                });
                // Update message in DB using messageId if available
                if (messageId && sessionIdRef.current) {
                  updateMessageAudioInDB(sessionIdRef.current, messageId, audioUrl);
                }
              }
            } else {
              const errorText = await response.text();
              console.error(`[finalizeAiAudio] Failed to upload AI audio for message ${messageIndex}:`, response.status, errorText);
            }
          })
          .catch(err => {
            console.error(`[finalizeAiAudio] Error uploading AI audio for message ${messageIndex}:`, err);
          });
      }
    }
  };

  // Helper function to update message audio URL in database using messageId
  const updateMessageAudioInDB = async (sessionId: number, messageId: number, audioUrl: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await fetch(`/api/content/sessions/${sessionId}/messages/${messageId}/audio`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          audioUrl
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to update message audio URL:', response.status, errorText);
      } else {
        console.log(`Successfully updated message ${messageId} with audio URL`);
      }
    } catch (err) {
      console.error('Error updating message audio URL:', err);
    }
  };

  const initializeAudio = async () => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Initialize combined session audio recorder (user + AI)
      // We need to mix both audio sources in an AudioContext before recording
      if (outputAudioContextRef.current && streamRef.current) {
        // Create a mixing audio context for the combined recording
        // Use the output context (24000 Hz) to match AI audio sample rate
        const mixingContext = outputAudioContextRef.current;
        
        // Create destination for mixed audio (user + AI)
        sessionAudioDestinationRef.current = mixingContext.createMediaStreamDestination();
        
        // Create a source from the microphone stream
        const micSource = mixingContext.createMediaStreamSource(streamRef.current);
        
        // Connect microphone to the destination (this will be mixed with AI audio)
        micSource.connect(sessionAudioDestinationRef.current);
        
        console.log('Microphone connected to session recorder');
        console.log('Session destination stream tracks:', sessionAudioDestinationRef.current.stream.getTracks().length);
        
        // Create recorder for the mixed stream
        const sessionRecorder = createAudioRecorder(sessionAudioDestinationRef.current.stream);
        if (sessionRecorder) {
          sessionAudioRecorderRef.current = sessionRecorder;
          sessionAudioChunksRef.current = [];
          
          sessionRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              sessionAudioChunksRef.current.push(event.data);
              console.log('Session audio chunk received:', event.data.size, 'bytes');
            }
          };
          
          // Start recording session audio immediately
          // No timeslice parameter - will collect all audio continuously
          // When stopped, all remaining data will be available in the final dataavailable event
          sessionRecorder.start();
          console.log('Session audio recording started with mixed stream');
        }
      }
      
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

    // Create session early to get sessionId for real-time audio uploads
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await fetch('/api/content/sessions/create-early', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            scenarioId: scenario.id,
            scenarioTitle: scenario.title,
            isCourseLesson: scenario.isCourseLesson || false,
            courseId: courseId || null,
            startedAt: sessionStartTimeRef.current
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.sessionId) {
            sessionIdRef.current = result.sessionId;
            console.log('Session created early with ID:', result.sessionId);
          }
        }
      }
    } catch (err) {
      console.error('Error creating early session:', err);
      // Continue even if session creation fails
    }

    // Reset states for new session
    micInputEnabledRef.current = false;
    setAiHasSpokenFirst(false);
    setIsWaitingForAiGreeting(false);
    isWaitingForAiGreetingRef.current = false;

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

                // Only send audio input if mic is enabled (after AI speaks first) and not paused
                sessionPromise.then((session) => {
                  if (session?.sendRealtimeInput && micInputEnabledRef.current && !isPausedRef.current) {
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
            // 1. AI AUDIO PROCESSING (clean pipeline)
            // CRITICAL: Gemini sends audio as MULTIPLE parts, not just parts[0]
            const parts = message.serverContent?.modelTurn?.parts;
            if (Array.isArray(parts)) {
              console.log('[GEMINI PARTS]', parts.length, 'parts in this message');
              for (const part of parts) {
                const base64Audio = part?.inlineData?.data;
                if (base64Audio && !isPausedRef.current) {
                  handleAiAudioChunk(base64Audio);
                }
              }
            }

            // 2. TRANSCRIPTION LOGIC - Real-time updates
            const outputText = message.serverContent?.outputTranscription?.text;
            if (outputText) {
              // Check if this is the start of a NEW AI message (no current output transcription)
              const isNewAiMessage = currentOutputTranscription.current.length === 0;
              
              // If this is a new AI message, clear any leftover chunks from previous message
              if (isNewAiMessage && aiAudioChunksRef.current.length > 0) {
                console.log(`[AI Audio] Starting new AI message - clearing ${aiAudioChunksRef.current.length} leftover chunks from previous message`);
                aiAudioChunksRef.current = [];
              }
              
              currentOutputTranscription.current += outputText;
              totalCharsTracked.current += outputText.length;
              
              // Update transcriptions in real-time for AI speech
              updateTranscriptions(prev => {
                const newTranscriptions = [...prev];
                const lastIndex = newTranscriptions.length - 1;
                
                // If last item is an AI message, update it (real-time transcription)
                if (lastIndex >= 0 && newTranscriptions[lastIndex].sender === 'ai') {
                  newTranscriptions[lastIndex] = {
                    ...newTranscriptions[lastIndex],
                    text: currentOutputTranscription.current
                  };
                } else {
                  // Add new AI transcription item
                  newTranscriptions.push({
                    text: currentOutputTranscription.current,
                    sender: 'ai',
                    timestamp: Date.now()
                  });
                }
                return newTranscriptions;
              });
              
              // If AI is speaking and we're waiting for the initial greeting, mark it as done
              if (isWaitingForAiGreetingRef.current && !aiHasSpokenFirst) {
                setAiHasSpokenFirst(true);
                console.log('AI has started speaking - initial greeting');
              }
            }
            
            const inputText = message.serverContent?.inputTranscription?.text;
            if (inputText) {
              // Start recording user audio when they start speaking
              if (!isRecordingUserAudioRef.current && streamRef.current && userAudioRecorderRef.current === null) {
                const userRecorder = createAudioRecorder(streamRef.current);
                if (userRecorder) {
                  userAudioRecorderRef.current = userRecorder;
                  isRecordingUserAudioRef.current = true;
                  currentUserAudioChunksRef.current = [];
                  userRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0 && isRecordingUserAudioRef.current) {
                      currentUserAudioChunksRef.current.push(event.data);
                      console.log(`[userAudio] Collected chunk: ${event.data.size} bytes (total chunks: ${currentUserAudioChunksRef.current.length})`);
                    }
                  };
                  // Start recording without timeslice to capture continuous audio
                  // When stopped, all remaining data will be available in the final dataavailable event
                  userRecorder.start();
                }
              }
              
              currentInputTranscription.current += inputText;
              totalCharsTracked.current += inputText.length;
              
              // Update transcriptions in real-time for user speech
              updateTranscriptions(prev => {
                const newTranscriptions = [...prev];
                const lastIndex = newTranscriptions.length - 1;
                
                // If last item is a user message, update it (real-time transcription)
                if (lastIndex >= 0 && newTranscriptions[lastIndex].sender === 'user') {
                  newTranscriptions[lastIndex] = {
                    ...newTranscriptions[lastIndex],
                    text: currentInputTranscription.current
                  };
                } else {
                  // Add new user transcription item
                  newTranscriptions.push({
                    text: currentInputTranscription.current,
                    sender: 'user',
                    timestamp: Date.now()
                  });
                }
                return newTranscriptions;
              });
            }

            if (message.serverContent?.turnComplete) {
              // Finalize transcriptions when turn is complete
              if (currentInputTranscription.current) {
                // Stop recording user audio and wait for all chunks
                // Keep recording for 3 seconds after turnComplete to capture full audio
                const processUserAudio = async () => {
                if (isRecordingUserAudioRef.current && userAudioRecorderRef.current && userAudioRecorderRef.current.state === 'recording') {
                    return new Promise<Blob | null>((resolve) => {
                      const recorder = userAudioRecorderRef.current!;
                      // Use a Set to track chunks we've already added to avoid duplicates
                      const chunks: Blob[] = [];
                      const chunkSet = new Set<Blob>();
                      
                      // Add all existing chunks
                      currentUserAudioChunksRef.current.forEach(chunk => {
                        if (!chunkSet.has(chunk)) {
                          chunks.push(chunk);
                          chunkSet.add(chunk);
                        }
                      });
                      
                      // Create a handler that continuously collects chunks
                      const continuousDataHandler = (event: BlobEvent) => {
                        if (event.data.size > 0 && isRecordingUserAudioRef.current) {
                          // Also update the ref so other handlers can see it
                          currentUserAudioChunksRef.current.push(event.data);
                          // Add to our local chunks array if not already there
                          if (!chunkSet.has(event.data)) {
                            chunks.push(event.data);
                            chunkSet.add(event.data);
                            console.log(`[turnComplete] Collected user audio chunk: ${event.data.size} bytes (total: ${chunks.length} chunks)`);
                          }
                        }
                      };
                      
                      // Replace the existing handler temporarily to collect all chunks
                      const originalHandler = recorder.ondataavailable;
                      recorder.ondataavailable = continuousDataHandler;
                      
                      // Wait a bit longer to ensure we capture the full message audio
                      // The turnComplete event fires when the user stops speaking, but we want to capture everything
                      // Increase wait time to ensure we get all audio that might still be buffered
                      setTimeout(() => {
                        // Listen for final data chunk
                        const finalDataHandler = (event: BlobEvent) => {
                          if (event.data.size > 0) {
                            if (!chunkSet.has(event.data)) {
                              chunks.push(event.data);
                              chunkSet.add(event.data);
                              console.log(`[turnComplete] Received final user audio chunk: ${event.data.size} bytes (total: ${chunks.length} chunks)`);
                            }
                          }
                        };
                        
                        // Listen for stop event to ensure all data is received
                        const stopHandler = () => {
                          recorder.removeEventListener('dataavailable', finalDataHandler);
                          recorder.removeEventListener('stop', stopHandler);
                          
                          // Restore original handler
                          recorder.ondataavailable = originalHandler;
                          
                          // Request any remaining data multiple times to ensure we get everything
                          const requestAllData = () => {
                            if (recorder.state !== 'inactive') {
                              try {
                                recorder.requestData();
                                console.log(`[turnComplete] Requested data from recorder (state: ${recorder.state})`);
                              } catch (e) {
                                console.log('Could not request data, recorder already stopped');
                              }
                            }
                          };
                          
                          // Request data multiple times with delays to catch all chunks
                          requestAllData();
                          setTimeout(requestAllData, 50);
                          setTimeout(requestAllData, 150);
                          setTimeout(requestAllData, 300);
                          setTimeout(requestAllData, 500);
                          
                          // Wait longer to ensure all data chunks are received
                          setTimeout(() => {
                            // Get any remaining chunks from the ref that we might have missed
                            currentUserAudioChunksRef.current.forEach(chunk => {
                              if (!chunkSet.has(chunk)) {
                                chunks.push(chunk);
                                chunkSet.add(chunk);
                                console.log(`[turnComplete] Added missed chunk: ${chunk.size} bytes`);
                              }
                            });
                            
                            // Combine all chunks including the final one
                            let userAudioBlob: Blob | null = null;
                            if (chunks.length > 0) {
                              const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
                              console.log(`[turnComplete] Combining ${chunks.length} user audio chunks (total size: ${totalSize} bytes)`);
                              // Estimate duration: webm at ~12kbps average, so roughly totalSize * 8 / 12000 seconds
                              const durationEstimate = (totalSize * 8) / 12000;
                              console.log(`[turnComplete] Estimated audio duration: ${durationEstimate.toFixed(2)}s`);
                              userAudioBlob = new Blob(chunks, { type: 'audio/webm' });
                              console.log(`[turnComplete] Created user audio blob: ${userAudioBlob.size} bytes, type: ${userAudioBlob.type}`);
                            } else {
                              console.warn(`[turnComplete] No user audio chunks to combine`);
                            }
                            
                            resolve(userAudioBlob);
                          }, 2000); // Wait 2 seconds after stop to ensure all chunks are received
                        };
                        
                        recorder.addEventListener('dataavailable', finalDataHandler);
                        recorder.addEventListener('stop', stopHandler);
                        
                        // Request data before stopping to get the current chunk
                        try {
                          recorder.requestData();
                          console.log(`[turnComplete] Requested data before stopping recorder`);
                        } catch (e) {
                          console.log('Could not request data before stop');
                        }
                        
                        // Stop the recorder - this will trigger the final dataavailable event with all remaining audio
                        console.log(`[turnComplete] Stopping user audio recorder (state: ${recorder.state})...`);
                        recorder.stop();
                        isRecordingUserAudioRef.current = false;
                        userAudioStopTimeRef.current = Date.now();
                        console.log(`[turnComplete] Stopped user audio recorder, waiting for final chunks...`);
                      }, 3000); // Wait 3 seconds after turnComplete to capture full audio (increased to ensure we get everything)
                    });
                  } else {
                    // If not recording, combine existing chunks
                const userChunkCount = currentUserAudioChunksRef.current.length;
                if (userChunkCount > 0) {
                      console.log(`[turnComplete] Combining ${userChunkCount} user audio chunks (recorder was not active)`);
                  const totalSize = currentUserAudioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
                  console.log(`[turnComplete] Total user audio chunks size: ${totalSize} bytes`);
                      const userAudioBlob = new Blob(currentUserAudioChunksRef.current, { type: 'audio/webm' });
                  console.log(`[turnComplete] Created user audio blob: ${userAudioBlob.size} bytes, type: ${userAudioBlob.type}`);
                      return Promise.resolve(userAudioBlob);
                    }
                    return Promise.resolve<Blob | null>(null);
                  }
                };
                
                // Wait for user audio to be fully processed
                const userAudioBlob = await processUserAudio();
                
                // Clear chunks after processing
                  currentUserAudioChunksRef.current = [];
                
                // Reset recorder for next message
                userAudioRecorderRef.current = null;
                
                const timestamp = Date.now();
                let messageIndex: number = transcriptionsRef.current.length;
                
                updateTranscriptions(prev => {
                  const newTranscriptions = [...prev];
                  const lastIndex = newTranscriptions.length - 1;
                  
                  // Update the last user message if it exists, otherwise add new one
                  if (lastIndex >= 0 && newTranscriptions[lastIndex].sender === 'user') {
                    messageIndex = lastIndex;
                    newTranscriptions[lastIndex] = {
                      ...newTranscriptions[lastIndex],
                      text: currentInputTranscription.current
                    };
                  } else {
                    messageIndex = newTranscriptions.length;
                    newTranscriptions.push({
                      text: currentInputTranscription.current,
                      sender: 'user',
                      timestamp: timestamp
                    });
                  }
                  
                  return newTranscriptions;
                });
                
                // Save message to DB immediately and wait for messageId
                const messageId = await saveMessageToDB(currentInputTranscription.current, 'user', timestamp);
                
                if (messageId) {
                  messageIdMapRef.current.set(messageIndex, messageId);
                  console.log(`[turnComplete] Saved user message to DB with messageId: ${messageId} at index ${messageIndex}`);
                } else {
                  console.warn(`[turnComplete] Failed to save user message to DB, messageId is null`);
                }
                
                // Store user audio for this message
                if (userAudioBlob && userAudioBlob.size > 0) {
                  console.log(`[turnComplete] User audio blob ready: ${userAudioBlob.size} bytes for message ${messageIndex}`);
                  const audioMap = messageAudioMapRef.current.get(messageIndex) || {};
                  audioMap.userAudio = userAudioBlob;
                  messageAudioMapRef.current.set(messageIndex, audioMap);
                  
                  // Upload user audio in real-time if sessionId is available
                  if (sessionIdRef.current) {
                    console.log(`[turnComplete] Starting upload for user audio, message ${messageIndex}, sessionId: ${sessionIdRef.current}`);
                    
                    // Upload via API route (server-side)
                    const token = localStorage.getItem('token');
                    if (token) {
                      const formData = new FormData();
                      formData.append('audio', userAudioBlob, `user-message-${messageIndex}.webm`);
                      formData.append('sender', 'user');
                      formData.append('messageIndex', messageIndex.toString());
                      
                      fetch(`/api/content/sessions/${sessionIdRef.current}/messages/audio`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${token}`
                        },
                        body: formData
                      })
                        .then(async (response) => {
                          if (response.ok) {
                            const result = await response.json();
                            const audioUrl = result.audioUrl;
                            if (audioUrl) {
                              console.log(`[turnComplete] User audio uploaded successfully for message ${messageIndex}:`, audioUrl);
                              // Update transcriptions to include audio URL
                              updateTranscriptions(prev => {
                                const updated = [...prev];
                                if (updated[messageIndex] && updated[messageIndex].sender === 'user') {
                                  updated[messageIndex] = {
                                    ...updated[messageIndex],
                                    audioUrl: audioUrl
                                  };
                                }
                                return updated;
                              });
                              // Update message in DB using messageId if available
                              if (messageId) {
                                updateMessageAudioInDB(sessionIdRef.current!, messageId, audioUrl);
                              } else {
                                console.warn(`[turnComplete] No messageId available for message ${messageIndex}, cannot update audio URL in DB`);
                              }
                            } else {
                              console.warn(`[turnComplete] User audio upload returned null for message ${messageIndex}`);
                            }
                          } else {
                            const errorText = await response.text();
                            console.error(`[turnComplete] Failed to upload user audio for message ${messageIndex}:`, response.status, errorText);
                          }
                        })
                        .catch(err => {
                          console.error(`[turnComplete] Error uploading user audio for message ${messageIndex}:`, err);
                        });
                    } else {
                      console.warn(`[turnComplete] No auth token available, cannot upload user audio for message ${messageIndex}`);
                    }
                  } else {
                    console.warn(`[turnComplete] No sessionId available, cannot upload user audio for message ${messageIndex}`);
                  }
                } else {
                  console.warn(`[turnComplete] User audio blob is empty or null for message ${messageIndex}`);
                }
                
                currentInputTranscription.current = '';
              }
              
              if (currentOutputTranscription.current) {
                const timestamp = Date.now();
                let messageIndex = transcriptionsRef.current.length - 1;
                
                // Update transcriptions
                updateTranscriptions(prev => {
                  const copy = [...prev];
                  if (copy[messageIndex] && copy[messageIndex].sender === 'ai') {
                    copy[messageIndex] = {
                      ...copy[messageIndex],
                      text: currentOutputTranscription.current
                    };
                  } else {
                    messageIndex = copy.length;
                    copy.push({
                      text: currentOutputTranscription.current,
                      sender: 'ai',
                      timestamp: timestamp
                    });
                  }
                  return copy;
                });
                
                // Save message to DB and get messageId
                const messageId = await saveMessageToDB(currentOutputTranscription.current, 'ai', timestamp);
                
                if (messageId) {
                  messageIdMapRef.current.set(messageIndex, messageId);
                  console.log(`[turnComplete] Saved AI message to DB with messageId: ${messageId} at index ${messageIndex}`);
                }
                
                // Finalize AI audio (clean pipeline)
                await finalizeAiAudio(messageIndex, messageId);
                
                currentOutputTranscription.current = '';
                
                // After AI finishes speaking the first time, enable microphone input
                if (isWaitingForAiGreetingRef.current && !micInputEnabledRef.current) {
                  console.log('AI finished initial greeting (turnComplete) - enabling microphone input');
                  setIsWaitingForAiGreeting(false);
                  isWaitingForAiGreetingRef.current = false;
                  micInputEnabledRef.current = true;
                }
              }
            }

            // 3. INTERRUPTION LOGIC
            if (message.serverContent?.interrupted) {
              aiSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              aiSourcesRef.current.clear();
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = outputAudioContextRef.current?.currentTime || 0;
              processingQueueRef.current = Promise.resolve(); // Clear queue
              aiProcessingQueueRef.current = Promise.resolve(); // Clear AI queue
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
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'aoede' } }
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        }
      });

      sessionRef.current = await sessionPromise;
      
      // Wait for session to be fully ready, then send initial greeting prompt
      setTimeout(async () => {
        try {
          console.log('Sending initial greeting prompt to AI');
          setIsWaitingForAiGreeting(true);
          isWaitingForAiGreetingRef.current = true;
          // Send a text prompt to make AI speak first
          const greetingPrompt = `Start the conversation by greeting the learner warmly and briefly explaining what we'll practice in this ${scenario.title} scenario. Keep it friendly and encouraging, about 2-3 sentences. Then ask them how they'd like to begin.`;
          
          if (sessionRef.current?.sendRealtimeInput) {
            await sessionRef.current.sendRealtimeInput({ 
              text: greetingPrompt 
            });
            console.log('Initial greeting prompt sent');
            
            // Safety timeout: Enable mic after 15 seconds even if AI hasn't finished
            setTimeout(() => {
              if (isWaitingForAiGreetingRef.current && !micInputEnabledRef.current) {
                console.log('Safety timeout: Enabling microphone input after 15 seconds');
                setIsWaitingForAiGreeting(false);
                isWaitingForAiGreetingRef.current = false;
                micInputEnabledRef.current = true;
              }
            }, 15000);
          } else {
            console.error('Session not available for sending greeting');
            setIsWaitingForAiGreeting(false);
            isWaitingForAiGreetingRef.current = false;
            micInputEnabledRef.current = true; // Enable mic if session not ready
          }
        } catch (err) {
          console.error('Error sending initial greeting:', err);
          setIsWaitingForAiGreeting(false);
          isWaitingForAiGreetingRef.current = false;
          micInputEnabledRef.current = true; // Enable mic if greeting fails
        }
      }, 1000); // Increased delay to ensure session is ready
      
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }, [scenario, showToast]);

  // Cleanup function to stop any ongoing description audio
  const stopDescriptionAudio = () => {
    // Clear timeout
    if (descriptionTimeoutRef.current) {
      clearTimeout(descriptionTimeoutRef.current);
      descriptionTimeoutRef.current = null;
    }
    
    // Stop AudioBufferSourceNode if playing
    if (descriptionAudioSourceRef.current) {
      try {
        descriptionAudioSourceRef.current.stop();
        descriptionAudioSourceRef.current.disconnect();
      } catch (e) {
        // Already stopped
      }
      descriptionAudioSourceRef.current = null;
    }
    
    // Close description audio context
    if (descriptionAudioContextRef.current) {
      try {
        descriptionAudioContextRef.current.close();
      } catch (e) {
        // Already closed
      }
      descriptionAudioContextRef.current = null;
    }
    
    // Stop SpeechSynthesis if playing
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      descriptionSpeechSynthesisRef.current = null;
    }
    
    setIsSpeakingDescription(false);
  };

  // Generate and speak AI description of the scenario
  useEffect(() => {
    console.log('Description useEffect triggered:', {
      showDescription,
      descriptionText: !!descriptionText,
      isGeneratingDescription,
      hasSpokenDescription: hasSpokenDescriptionRef.current,
      isGenerating: isGeneratingRef.current
    });
    
    // Only generate once when component mounts and showDescription is true
    if (showDescription && !hasSpokenDescriptionRef.current) {
      // Set a fallback description immediately so button can appear
      if (!descriptionText) {
        const fallbackText = `Welcome to ${scenario.title}! ${scenario.description || 'This scenario will help you practice your English conversation skills.'}`;
        console.log('Setting immediate fallback description:', fallbackText);
        setDescriptionText(fallbackText);
      }
      
      // Generate AI description and speak it
      if (!isGeneratingDescription && !isGeneratingRef.current) {
        console.log('Calling generateDescription');
        generateDescription();
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (descriptionTimeoutRef.current) {
        clearTimeout(descriptionTimeoutRef.current);
        descriptionTimeoutRef.current = null;
      }
      stopDescriptionAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDescription]);

  const generateDescription = async () => {
    // Prevent multiple calls
    if (isGeneratingDescription || hasSpokenDescriptionRef.current || isGeneratingRef.current) {
      console.log('generateDescription: Already generating or spoken, skipping');
      return;
    }
    
    console.log('generateDescription: Starting...');
    isGeneratingRef.current = true;
    setIsGeneratingDescription(true);
    
    // Set a timeout to ensure audio stops if it takes too long
    if (descriptionTimeoutRef.current) {
      clearTimeout(descriptionTimeoutRef.current);
    }
    descriptionTimeoutRef.current = setTimeout(() => {
      console.log('Description timeout: Stopping audio');
      setIsSpeakingDescription(false);
      hasSpokenDescriptionRef.current = true;
    }, 20000); // 20 second timeout for audio
    
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const currentText = descriptionText || `Welcome to ${scenario.title}! ${scenario.description || 'This scenario will help you practice your English conversation skills.'}`;
    
    if (!apiKey) {
      console.log('No API key, speaking existing description');
      setIsGeneratingDescription(false);
      isGeneratingRef.current = false;
      // Try to speak the existing description
      try {
        await speakDescription(currentText);
      } catch (err) {
        console.error('Error in speakDescription:', err);
        setIsSpeakingDescription(false);
      }
      hasSpokenDescriptionRef.current = true;
      return;
    }

    try {
      console.log('Generating description with AI...');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: `You are ${AI_AGENT.NAME}, a friendly English language coach. Describe this scenario to the learner in a warm, encouraging way. Keep it brief (2-3 sentences) and explain what they will practice. Scenario: ${scenario.title}. Description: ${scenario.description}. Prompt: ${scenario.prompt}. Only respond with the description, no additional text.`,
      });
      
      const aiDescription = response.text?.trim();
      if (aiDescription && aiDescription.length > 0) {
        console.log('AI description generated:', aiDescription);
        setDescriptionText(aiDescription);
        // Wait for audio to finish before marking as complete
        try {
          await speakDescription(aiDescription);
        } catch (err) {
          console.error('Error speaking AI description:', err);
          setIsSpeakingDescription(false);
        }
      } else {
        console.log('No AI description, using existing and speaking it');
        try {
          await speakDescription(currentText);
        } catch (err) {
          console.error('Error speaking existing description:', err);
          setIsSpeakingDescription(false);
        }
      }
      hasSpokenDescriptionRef.current = true;
    } catch (error: any) {
      console.error('Error generating description:', error);
      // If it's a quota/rate limit error, just use the fallback and speak it
      const isQuotaError = error?.error?.code === 429 || error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota');
      
      if (isQuotaError) {
        console.log('Quota exceeded, using fallback description and speaking it');
      }
      
      // Ensure description text is set
      if (!descriptionText) {
        setDescriptionText(currentText);
      }
      
      // Speak the existing description
      try {
        await speakDescription(currentText);
      } catch (err) {
        console.error('Error in speakDescription fallback:', err);
        setIsSpeakingDescription(false);
      }
      hasSpokenDescriptionRef.current = true;
    } finally {
      setIsGeneratingDescription(false);
      isGeneratingRef.current = false;
    }
  };

  const speakDescription = async (text: string): Promise<void> => {
    console.log('speakDescription called with text:', text);
    
    // CRITICAL: Stop ALL existing audio first to prevent overlapping
    stopDescriptionAudio();
    
    // Wait a tiny bit to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      console.log('No API key, using browser TTS fallback');
      // Fallback to browser TTS
      if ('speechSynthesis' in window) {
        // Cancel ALL speech synthesis to prevent overlapping
        speechSynthesis.cancel();
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-IN'; // Indian English
        utterance.rate = 0.9;
        utterance.pitch = 1.1; // Slightly higher pitch for female voice
        
        // Try to select a female Indian English voice if available
        const voices = speechSynthesis.getVoices();
        const indianFemaleVoice = voices.find(voice => 
          voice.lang.startsWith('en-IN') && 
          (voice.name.toLowerCase().includes('female') || 
           voice.name.toLowerCase().includes('priya') ||
           voice.name.toLowerCase().includes('neural') ||
           voice.name.toLowerCase().includes('woman') ||
           voice.name.toLowerCase().includes('girl'))
        );
        
        if (indianFemaleVoice) {
          utterance.voice = indianFemaleVoice;
          console.log('Using Indian female voice:', indianFemaleVoice.name);
        } else {
          // Fallback: try to find any Indian English voice
          const indianVoice = voices.find(voice => voice.lang.startsWith('en-IN'));
          if (indianVoice) {
            utterance.voice = indianVoice;
            console.log('Using Indian voice:', indianVoice.name);
          }
        }
        
        descriptionSpeechSynthesisRef.current = utterance;
        setIsSpeakingDescription(true);
        
        // Return a promise that resolves when speech ends
        return new Promise<void>((resolve, reject) => {
          utterance.onend = () => {
            console.log('Browser TTS ended');
            setIsSpeakingDescription(false);
            descriptionSpeechSynthesisRef.current = null;
            if (descriptionTimeoutRef.current) {
              clearTimeout(descriptionTimeoutRef.current);
              descriptionTimeoutRef.current = null;
            }
            resolve();
          };
          utterance.onerror = (e) => {
            console.error('Browser TTS error:', e);
            setIsSpeakingDescription(false);
            descriptionSpeechSynthesisRef.current = null;
            if (descriptionTimeoutRef.current) {
              clearTimeout(descriptionTimeoutRef.current);
              descriptionTimeoutRef.current = null;
            }
            reject(e);
          };
          speechSynthesis.speak(utterance);
          console.log('Browser TTS started');
        });
      } else {
        console.error('Browser TTS not available');
        setIsSpeakingDescription(false);
        return Promise.resolve();
      }
    }

    try {
      console.log('Attempting Gemini TTS...');
      setIsSpeakingDescription(true);
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'aoede' } }
          }
        },
      });

      console.log('Gemini TTS response received');
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        console.log('Audio data received, length:', base64Audio.length);
        // Create a separate audio context for description to avoid conflicts with conversation audio
        if (!descriptionAudioContextRef.current || descriptionAudioContextRef.current.state === 'closed') {
          descriptionAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          console.log('Created new audio context for description');
        }
        const ctx = descriptionAudioContextRef.current;
        
        // Resume audio context if suspended (required for autoplay policies)
        if (ctx.state === 'suspended') {
          console.log('Resuming suspended audio context');
          await ctx.resume();
        }

        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        console.log('Audio buffer decoded, duration:', audioBuffer.duration, 'seconds');
        
        // Return a promise that resolves when audio playback ends
        return new Promise<void>((resolve, reject) => {
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          
          // Store reference for cleanup
          descriptionAudioSourceRef.current = source;
          
          source.onended = () => {
            console.log('Description audio playback ended - setting isSpeakingDescription to false');
            setIsSpeakingDescription(false);
            descriptionAudioSourceRef.current = null;
            if (descriptionTimeoutRef.current) {
              clearTimeout(descriptionTimeoutRef.current);
              descriptionTimeoutRef.current = null;
            }
            console.log('Resolving speakDescription promise');
            resolve();
          };
          
          // Handle errors by wrapping start() in try-catch
          try {
            console.log('Starting audio playback');
            source.start(0);
          } catch (error) {
            console.error('Description audio playback error:', error);
            setIsSpeakingDescription(false);
            descriptionAudioSourceRef.current = null;
            if (descriptionTimeoutRef.current) {
              clearTimeout(descriptionTimeoutRef.current);
              descriptionTimeoutRef.current = null;
            }
            // Fallback to browser TTS on error
            if ('speechSynthesis' in window) {
              console.log('Falling back to browser TTS due to audio playback error');
              speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(text);
              utterance.lang = 'en-US';
              utterance.rate = 0.9;
              descriptionSpeechSynthesisRef.current = utterance;
              setIsSpeakingDescription(true);
              utterance.onend = () => {
                setIsSpeakingDescription(false);
                descriptionSpeechSynthesisRef.current = null;
                resolve();
              };
              utterance.onerror = () => {
                setIsSpeakingDescription(false);
                descriptionSpeechSynthesisRef.current = null;
                reject(new Error('Browser TTS error'));
              };
              speechSynthesis.speak(utterance);
            } else {
              reject(error);
            }
          }
        });
      } else {
        console.warn('No audio data in response, falling back to browser TTS');
        // Fallback to browser TTS
        if ('speechSynthesis' in window) {
          speechSynthesis.cancel();
          await new Promise(resolve => setTimeout(resolve, 50));
          
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'en-US';
          utterance.rate = 0.9;
          descriptionSpeechSynthesisRef.current = utterance;
          setIsSpeakingDescription(true);
          
          return new Promise<void>((resolve, reject) => {
            utterance.onend = () => {
              setIsSpeakingDescription(false);
              descriptionSpeechSynthesisRef.current = null;
              if (descriptionTimeoutRef.current) {
                clearTimeout(descriptionTimeoutRef.current);
                descriptionTimeoutRef.current = null;
              }
              resolve();
            };
            utterance.onerror = () => {
              setIsSpeakingDescription(false);
              descriptionSpeechSynthesisRef.current = null;
              if (descriptionTimeoutRef.current) {
                clearTimeout(descriptionTimeoutRef.current);
                descriptionTimeoutRef.current = null;
              }
              reject(new Error('Browser TTS error'));
            };
            speechSynthesis.speak(utterance);
          });
        } else {
          setIsSpeakingDescription(false);
          if (descriptionTimeoutRef.current) {
            clearTimeout(descriptionTimeoutRef.current);
            descriptionTimeoutRef.current = null;
          }
          return Promise.resolve();
        }
      }
    } catch (error) {
      console.error('Error speaking description with Gemini TTS:', error);
      // Fallback to browser TTS
      if ('speechSynthesis' in window) {
        console.log('Falling back to browser TTS due to error');
        speechSynthesis.cancel();
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        descriptionSpeechSynthesisRef.current = utterance;
        setIsSpeakingDescription(true);
        
        return new Promise<void>((resolve, reject) => {
          utterance.onend = () => {
            setIsSpeakingDescription(false);
            descriptionSpeechSynthesisRef.current = null;
            if (descriptionTimeoutRef.current) {
              clearTimeout(descriptionTimeoutRef.current);
              descriptionTimeoutRef.current = null;
            }
            resolve();
          };
          utterance.onerror = (e) => {
            console.error('Browser TTS error in fallback:', e);
            setIsSpeakingDescription(false);
            descriptionSpeechSynthesisRef.current = null;
            if (descriptionTimeoutRef.current) {
              clearTimeout(descriptionTimeoutRef.current);
              descriptionTimeoutRef.current = null;
            }
            reject(e);
          };
          speechSynthesis.speak(utterance);
        });
      } else {
        setIsSpeakingDescription(false);
        if (descriptionTimeoutRef.current) {
          clearTimeout(descriptionTimeoutRef.current);
          descriptionTimeoutRef.current = null;
        }
        return Promise.resolve();
      }
    }
  };

  const handleStartConversation = () => {
    // Stop any description audio before starting conversation
    stopDescriptionAudio();
    
    // Small delay to ensure audio is fully stopped
    setTimeout(() => {
      setShowDescription(false);
      setConversationStarted(true);
      startSession();
    }, 100);
  };

  useEffect(() => {
    if (conversationStarted) {
      return () => {
        // Stop description audio when conversation starts
        stopDescriptionAudio();
        sessionRef.current?.close();
        streamRef.current?.getTracks().forEach(t => t.stop());
        audioContextRef.current?.close();
        outputAudioContextRef.current?.close();
      };
    }
  }, [conversationStarted]);

  // Auto-scroll to bottom when new transcriptions arrive
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [transcriptions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDescriptionAudio();
    };
  }, []);

  const handlePause = () => {
    setIsPaused(true);
    isPausedRef.current = true;
    // Remember if mic was enabled before pause
    wasMicEnabledBeforePause.current = micInputEnabledRef.current;
    // Temporarily disable mic input
    micInputEnabledRef.current = false;
    // Stop all playing audio (both old and new pipeline)
    aiSourcesRef.current.forEach(s => {
      try {
        s.stop();
      } catch (e) {
        // Ignore errors
      }
    });
    aiSourcesRef.current.clear();
    sourcesRef.current.forEach(s => {
      try {
        s.stop();
      } catch (e) {
        // Ignore errors
      }
    });
    sourcesRef.current.clear();
    setIsAiSpeaking(false);
  };

  const handleResume = () => {
    setIsPaused(false);
    isPausedRef.current = false;
    // Restore mic state if it was enabled before pause
    if (wasMicEnabledBeforePause.current) {
      micInputEnabledRef.current = true;
    }
    // Resume audio context if needed
    if (outputAudioContextRef.current?.state === 'suspended') {
      outputAudioContextRef.current.resume();
    }
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const handleEnd = async () => {
    // Close the session connection first
    try {
      if (sessionRef.current) {
        console.log('Closing session connection...');
        sessionRef.current.close();
        sessionRef.current = null;
      }
    } catch (err) {
      console.error('Error closing session:', err);
    }

    // Stop all audio sources (both old and new pipeline)
    try {
      aiSourcesRef.current.forEach(s => {
        try {
          s.stop();
        } catch (e) {
          // Ignore errors
        }
      });
      aiSourcesRef.current.clear();
      sourcesRef.current.forEach(s => {
        try {
          s.stop();
        } catch (e) {
          // Ignore errors
        }
      });
      sourcesRef.current.clear();
    } catch (err) {
      console.error('Error stopping audio sources:', err);
    }

    // Stop microphone stream
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    } catch (err) {
      console.error('Error stopping microphone stream:', err);
    }

    // Close audio contexts
    try {
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (outputAudioContextRef.current) {
        await outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
      }
    } catch (err) {
      console.error('Error closing audio contexts:', err);
    }

    // Stop session audio recorder
    let sessionAudioBlob: Blob | null = null;
    if (sessionAudioRecorderRef.current && sessionAudioRecorderRef.current.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 2000);
        if (sessionAudioRecorderRef.current) {
          const originalOnStop = sessionAudioRecorderRef.current.onstop;
          sessionAudioRecorderRef.current.onstop = (event) => {
            if (originalOnStop) originalOnStop.call(sessionAudioRecorderRef.current!, event);
            clearTimeout(timeout);
            resolve();
          };
          sessionAudioRecorderRef.current.stop();
        } else {
          clearTimeout(timeout);
          resolve();
        }
      });
      
      // Combine all session audio chunks
      if (sessionAudioChunksRef.current.length > 0) {
        sessionAudioBlob = new Blob(sessionAudioChunksRef.current, { type: 'audio/webm' });
        console.log(`Session audio created: ${sessionAudioBlob.size} bytes from ${sessionAudioChunksRef.current.length} chunks`);
      }
    }
    
    // Token estimation: 
    // - Average English text: ~3.5-4 characters per token
    // - System prompts and overhead: ~100-150 tokens
    // - Audio processing overhead: ~50 tokens
    // Using 4 chars/token for conservative estimate
    const textTokens = Math.ceil(totalCharsTracked.current / 4);
    const systemOverhead = 150; // System prompts, audio processing, etc.
    const estimatedTokens = textTokens + systemOverhead;
    
    console.log(`Session ended - Characters: ${totalCharsTracked.current}, Estimated tokens: ${estimatedTokens}`);
    
    // Upload session audio if available and sessionId exists
    let sessionAudioUrl: string | null = null;
    if (sessionAudioBlob && sessionAudioBlob.size > 0 && sessionIdRef.current) {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const formData = new FormData();
          formData.append('audio', sessionAudioBlob, 'session-audio.webm');
          
          const response = await fetch(`/api/content/sessions/${sessionIdRef.current}/audio`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });
          
          if (response.ok) {
            const result = await response.json();
            sessionAudioUrl = result.audioUrl || null;
            console.log('Session audio uploaded:', sessionAudioUrl);
          } else {
            console.error('Failed to upload session audio:', response.statusText);
          }
        }
      } catch (err) {
        console.error('Error uploading session audio:', err);
      }
    }
    
    // Use ref to get the latest transcriptions (state might be stale)
    const latestTranscriptions = transcriptionsRef.current.length > 0 
      ? transcriptionsRef.current 
      : transcriptions;
    
    console.log(`Ending session with ${latestTranscriptions.length} transcriptions:`, latestTranscriptions);
    
    // Pass sessionAudioUrl (string) and sessionId to parent
    onEnd(estimatedTokens, latestTranscriptions, sessionAudioUrl, sessionIdRef.current);
  };

  // Show description phase
  if (showDescription) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-in zoom-in duration-300">
        {/* Header */}
        <div className={`p-6 flex justify-between items-center text-white ${scenario.isCourseLesson ? 'bg-gradient-to-r from-green-600 to-teal-700' : 'bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800'}`}>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded">
              {scenario.isCourseLesson ? 'Course Mode' : 'Scenario Mode'}
            </span>
            <h2 className="text-xl font-bold">{scenario.title}</h2>
          </div>
        </div>

        {/* Image and Description */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-gray-50 to-white">
          {scenario.image && scenario.image.trim() !== '' && (
            <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-lg border border-gray-200">
              <img 
                src={scenario.image} 
                alt={scenario.title}
                className="w-full h-auto object-cover max-h-96"
                onError={(e) => {
                  console.error('Failed to load scenario image:', scenario.image);
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
                onLoad={() => {
                  console.log('Scenario image loaded successfully:', scenario.image);
                }}
              />
            </div>
          )}
          
          <div className="max-w-2xl w-full space-y-6">
            <div className="bg-white rounded-2xl p-8 shadow-md border border-gray-100">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <i className={`fas ${scenario.icon} text-green-600 text-xl`}></i>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{scenario.title}</h3>
                  <p className="text-gray-600 mb-4 leading-relaxed">{scenario.description}</p>
                  
                  {isGeneratingDescription ? (
                    <div className="flex items-center gap-3 text-green-600">
                      <i className="fas fa-circle-notch fa-spin"></i>
                      <p className="text-sm font-medium">{AI_AGENT.NAME} is preparing your scenario...</p>
                    </div>
                  ) : descriptionText ? (
                    <div className="bg-green-50 rounded-xl p-6 border-l-4 border-green-500">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0 ${isSpeakingDescription ? 'animate-pulse' : ''}`}>
                          <i className={`fas ${isSpeakingDescription ? 'fa-volume-up' : 'fa-brain'} text-white text-sm`}></i>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-green-900 mb-2">
                            {AI_AGENT.NAME} {isSpeakingDescription ? 'is speaking...' : 'says:'}
                          </p>
                          <p className="text-gray-700 leading-relaxed">{descriptionText}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Show start button - always available, with skip option while speaking */}
            {(() => {
              console.log('Button render check:', {
                descriptionText: !!descriptionText,
                isSpeakingDescription,
                isGeneratingDescription,
                hasSpokenDescription: hasSpokenDescriptionRef.current
              });
              
              if (descriptionText) {
                if (!isSpeakingDescription) {
                  return (
                    <button
                      onClick={handleStartConversation}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold py-4 px-8 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-3 text-lg"
                    >
                      <i className="fas fa-play-circle"></i>
                      <span>Start Conversation</span>
                    </button>
                  );
                } else {
                  return (
                    <div className="w-full space-y-3">
                      <div className="bg-green-100 text-green-700 font-medium py-4 px-8 rounded-2xl flex items-center justify-center gap-3">
                        <i className="fas fa-volume-up animate-pulse"></i>
                        <span>Listening to {AI_AGENT.NAME}...</span>
                      </div>
                      <button
                        onClick={handleStartConversation}
                        className="w-full bg-gray-500 text-white font-medium py-3 px-6 rounded-xl hover:bg-gray-600 transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <i className="fas fa-forward"></i>
                        <span>Skip & Start Conversation</span>
                      </button>
                    </div>
                  );
                }
              } else {
                return (
                  <div className="w-full space-y-3">
                    {isGeneratingDescription ? (
                      <div className="bg-green-100 text-green-700 font-medium py-4 px-8 rounded-2xl flex items-center justify-center gap-3">
                        <i className="fas fa-circle-notch fa-spin"></i>
                        <span>Preparing scenario...</span>
                      </div>
                    ) : (
                      <button
                        onClick={handleStartConversation}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold py-4 px-8 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-3 text-lg"
                      >
                        <i className="fas fa-play-circle"></i>
                        <span>Start Conversation</span>
                      </button>
                    )}
                  </div>
                );
              }
            })()}
          </div>
        </div>
      </div>
    );
  }

  // Show conversation phase
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-in zoom-in duration-300">
      {/* Header */}
      <div className={`p-6 flex justify-between items-center text-white ${scenario.isCourseLesson ? 'bg-gradient-to-r from-green-600 to-teal-700' : 'bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800'}`}>
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded">
            {scenario.isCourseLesson ? 'Course Mode' : 'Scenario Mode'}
          </span>
          <h2 className="text-xl font-bold">{scenario.title}</h2>
        </div>
        <div className="flex items-center gap-3">
          {isPaused ? (
            <button onClick={handleResume} className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors flex items-center gap-2 px-4">
              <span className="text-xs font-bold uppercase">Resume</span>
              <i className="fas fa-play"></i>
            </button>
          ) : (
            <button onClick={handlePause} className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors flex items-center gap-2 px-4">
              <span className="text-xs font-bold uppercase">Pause</span>
              <i className="fas fa-pause"></i>
            </button>
          )}
          <button onClick={handleEnd} className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors flex items-center gap-2 px-4">
            <span className="text-xs font-bold uppercase">Finish</span>
            <i className="fas fa-check"></i>
          </button>
        </div>
      </div>
      
      {/* AI Speaking First Indicator */}
      {isWaitingForAiGreeting && (
        <div className="mx-6 mt-4 bg-green-50 border-l-4 border-green-500 p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <i className="fas fa-volume-up text-green-600 animate-pulse"></i>
            <div>
              <p className="text-sm font-bold text-green-900">{AI_AGENT.NAME} is speaking first...</p>
              <p className="text-xs text-green-700 mt-1">Please wait for {AI_AGENT.NAME} to finish before you speak.</p>
            </div>
          </div>
        </div>
      )}

      {/* Paused Indicator */}
      {isPaused && (
        <div className="mx-6 mt-4 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <i className="fas fa-pause text-yellow-600"></i>
            <div>
              <p className="text-sm font-bold text-yellow-900">Conversation Paused</p>
              <p className="text-xs text-yellow-700 mt-1">Click Resume to continue the conversation.</p>
            </div>
          </div>
        </div>
      )}

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 bg-gray-50/50">
        {!isReady && !error && (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 space-y-4">
            <i className="fas fa-circle-notch fa-spin text-3xl text-green-600"></i>
            <p className="text-lg">Connecting to {AI_AGENT.NAME}...</p>
          </div>
        )}
        
        {transcriptions.map((t, i) => (
          <div key={i} className={`flex ${t.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${t.sender === 'user' ? 'bg-green-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}`}>
              <p className="text-sm font-medium mb-1 opacity-70">{t.sender === 'user' ? 'You' : AI_AGENT.NAME}</p>
              <p className="leading-relaxed">{t.text}</p>
            </div>
          </div>
        ))}
        {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-center">{error}</div>}
        <div ref={chatEndRef} />
      </div>

      {/* Footer Visualizer */}
      <div className="p-8 border-t bg-white flex flex-col items-center gap-6">
        <div className="flex items-center gap-12">
          <div className="text-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">You</p>
            <VoiceVisualizer isActive={isUserSpeaking} color="bg-green-400" />
          </div>
          
          <div className="relative">
             <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-lg ${isAiSpeaking ? 'bg-slate-700' : 'bg-gray-200'} scale-110`}>
                <i className={`fas ${scenario.isCourseLesson ? 'fa-graduation-cap' : 'fa-brain'} text-2xl ${isAiSpeaking ? 'text-white' : 'text-gray-400'}`}></i>
             </div>
             {isAiSpeaking && <div className="absolute -inset-2 border-2 border-green-200 rounded-full animate-ping opacity-20"></div>}
          </div>

          <div className="text-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{AI_AGENT.NAME}</p>
            <VoiceVisualizer isActive={isAiSpeaking} color="bg-slate-500" />
          </div>
        </div>
        <p className="text-gray-500 text-sm font-medium italic">
          {isPaused ? "Conversation paused. Click Resume to continue." :
           !isReady ? "Connecting..." : 
           isWaitingForAiGreeting ? `${AI_AGENT.NAME} is introducing the scenario...` :
           isAiSpeaking ? `${AI_AGENT.NAME} is speaking...` : 
           !micInputEnabledRef.current ? `Waiting for ${AI_AGENT.NAME} to speak first...` :
           isUserSpeaking ? "Listening to you..." : 
           "You can speak now..."}
        </p>
      </div>
    </div>
  );
};

export default LiveSession;