'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { SYSTEM_INSTRUCTION, AI_AGENT } from '@/lib/constants';
import { Scenario, TranscriptionItem } from '@/types';
import { decode, decodeAudioData, createBlob } from '@/lib/utils/audioUtils';
import VoiceVisualizer from './VoiceVisualizer';
import { useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/errorHandler';

interface LiveSessionProps {
  scenario: Scenario;
  onEnd: (estimatedTokens?: number, transcriptions?: TranscriptionItem[]) => void;
}

const LiveSession: React.FC<LiveSessionProps> = ({ scenario, onEnd }) => {
  const { showToast } = useToast();
  const [isReady, setIsReady] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [transcriptions, setTranscriptions] = useState<TranscriptionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
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

  // Session & Stream Refs
  const sessionRef = useRef<any>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Data Tracking
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');
  const totalCharsTracked = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
            // 1. SEQUENTIAL AUDIO PROCESSING
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && !isPausedRef.current) {
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
                    if (sourcesRef.current.size === 0) {
                      setIsAiSpeaking(false);
                      
                      // After AI finishes speaking the first time, enable microphone input
                      if (isWaitingForAiGreetingRef.current && !micInputEnabledRef.current) {
                        console.log('AI finished speaking - enabling microphone input');
                        setIsWaitingForAiGreeting(false);
                        isWaitingForAiGreetingRef.current = false;
                        micInputEnabledRef.current = true;
                      }
                    }
                  };

                  source.start(startTime);
                  nextStartTimeRef.current = startTime + audioBuffer.duration;
                  sourcesRef.current.add(source);
                } catch (err) {
                  console.error('Audio playback error:', err);
                }
              });
            }

            // 2. TRANSCRIPTION LOGIC - Real-time updates
            const outputText = message.serverContent?.outputTranscription?.text;
            if (outputText) {
              currentOutputTranscription.current += outputText;
              totalCharsTracked.current += outputText.length;
              
              // Update transcriptions in real-time for AI speech
              setTranscriptions(prev => {
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
              currentInputTranscription.current += inputText;
              totalCharsTracked.current += inputText.length;
              
              // Update transcriptions in real-time for user speech
              setTranscriptions(prev => {
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
                setTranscriptions(prev => {
                  const newTranscriptions = [...prev];
                  const lastIndex = newTranscriptions.length - 1;
                  
                  // Update the last user message if it exists, otherwise add new one
                  if (lastIndex >= 0 && newTranscriptions[lastIndex].sender === 'user') {
                    newTranscriptions[lastIndex] = {
                      ...newTranscriptions[lastIndex],
                      text: currentInputTranscription.current
                    };
                  } else {
                    newTranscriptions.push({
                      text: currentInputTranscription.current,
                      sender: 'user',
                      timestamp: Date.now()
                    });
                  }
                  return newTranscriptions;
                });
                currentInputTranscription.current = '';
              }
              
              if (currentOutputTranscription.current) {
                setTranscriptions(prev => {
                  const newTranscriptions = [...prev];
                  const lastIndex = newTranscriptions.length - 1;
                  
                  // Update the last AI message if it exists, otherwise add new one
                  if (lastIndex >= 0 && newTranscriptions[lastIndex].sender === 'ai') {
                    newTranscriptions[lastIndex] = {
                      ...newTranscriptions[lastIndex],
                      text: currentOutputTranscription.current
                    };
                  } else {
                    newTranscriptions.push({
                      text: currentOutputTranscription.current,
                      sender: 'ai',
                      timestamp: Date.now()
                    });
                  }
                  return newTranscriptions;
                });
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
          
          console.log('Starting audio playback');
          source.start(0);
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
    // Stop all playing audio
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

  const handleEnd = () => {
    // Token estimation: 
    // - Average English text: ~3.5-4 characters per token
    // - System prompts and overhead: ~100-150 tokens
    // - Audio processing overhead: ~50 tokens
    // Using 4 chars/token for conservative estimate
    const textTokens = Math.ceil(totalCharsTracked.current / 4);
    const systemOverhead = 150; // System prompts, audio processing, etc.
    const estimatedTokens = textTokens + systemOverhead;
    
    console.log(`Session ended - Characters: ${totalCharsTracked.current}, Estimated tokens: ${estimatedTokens}`);
    onEnd(estimatedTokens, transcriptions);
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