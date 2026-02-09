'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, Type, LiveServerMessage } from '@google/genai';
import { DocumentState } from '@/types';
import { decode, decodeAudioData, createBlob } from '@/lib/utils/audioUtils';

type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

interface VoiceInputPanelProps {
  document: DocumentState;
  onDocumentUpdate: (doc: DocumentState) => void;
  onUndo: () => boolean;
  hasHistory: boolean;
  onSave: () => void;
  onClose: () => void;
}

const SYSTEM_INSTRUCTION = `You are a voice assistant for a document editor. Speak only in English.
Your role is to edit the document via voice commands.

CAPABILITIES:
1. Dictation: Add or change content using the update_document tool (pass title and/or paragraphs as array of strings).
2. Undo: Revert the last change with undo_last_action.
3. Clear: Reset the document with clear_document — ONLY after the user confirms (e.g. "Yes", "Proceed").
4. Save: Save the document with save_document.

RULES:
1. Confirm every action briefly (e.g. "Done.", "Saved.", "Reverted.").
2. For "Clear document" or "Delete everything", ask for confirmation first. Only call clear_document after they confirm.
3. When the user says "Undo" or "Go back", use undo_last_action.
4. For "write", "dictate", or adding text, use update_document with the full paragraphs array (include existing content plus new).
5. When the user says "Save" or "Save document", use save_document.
6. If they ask for context or to read back, briefly summarize the current document.`;

export default function VoiceInputPanel({
  document: docState,
  onDocumentUpdate,
  onUndo,
  hasHistory,
  onSave,
  onClose,
}: VoiceInputPanelProps) {
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const docRef = useRef<DocumentState>(docState);
  const hasHistoryRef = useRef(hasHistory);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<{ sendRealtimeInput: (x: { media: { data: string; mimeType: string } }) => void; sendToolResponse: (x: unknown) => void; close: () => void } | null>(null);
  const sessionPromiseRef = useRef<Promise<unknown> | null>(null);

  useEffect(() => {
    docRef.current = docState;
    hasHistoryRef.current = hasHistory;
  }, [docState, hasHistory]);

  const stopAllAudio = () => {
    sourcesRef.current.forEach((s) => {
      try { s.stop(); } catch {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const connect = async () => {
    if (status !== 'DISCONNECTED') return;
    setStatus('CONNECTING');
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    if (!apiKey) {
      setStatus('ERROR');
      return;
    }
    try {
      const ai = new GoogleGenAI({ apiKey });
      const inputCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({ sampleRate: 16000 });
      const outCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = inputCtx;
      outputAudioContextRef.current = outCtx;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{
            functionDeclarations: [
              {
                name: 'update_document',
                description: 'Updates the title or content of the current document.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: 'New title' },
                    paragraphs: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Full list of paragraphs.' },
                  },
                },
              },
              { name: 'undo_last_action', description: 'Reverts the last change.', parameters: { type: Type.OBJECT, properties: {} } },
              { name: 'clear_document', description: 'Clears the document. Use only after user confirmation.', parameters: { type: Type.OBJECT, properties: {} } },
              { name: 'save_document', description: 'Saves the document.', parameters: { type: Type.OBJECT, properties: {} } },
            ],
          }],
        },
        callbacks: {
          onopen: () => {
            setStatus('CONNECTED');
            const source = inputCtx.createMediaStreamSource(stream);
            const proc = inputCtx.createScriptProcessor(4096, 1, 1);
            proc.onaudioprocess = (e: AudioProcessingEvent) => {
              const data = e.inputBuffer.getChannelData(0);
              const blob = createBlob(data);
              sessionPromiseRef.current?.then((s: unknown) => (s as { sendRealtimeInput: (x: { media: { data: string; mimeType: string } }) => void })?.sendRealtimeInput?.({ media: blob }));
            };
            source.connect(proc);
            proc.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64 = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64 && outCtx) {
              setIsSpeaking(true);
              const buf = await decodeAudioData(decode(base64), outCtx, 24000, 1);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
              const src = outCtx.createBufferSource();
              src.buffer = buf;
              src.connect(outCtx.destination);
              src.onended = () => {
                sourcesRef.current.delete(src);
                if (sourcesRef.current.size === 0) setIsSpeaking(false);
              };
              src.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buf.duration;
              sourcesRef.current.add(src);
            }
            if (message.serverContent?.interrupted) {
              stopAllAudio();
              setIsSpeaking(false);
            }
            const fcList = message.toolCall?.functionCalls;
            if (fcList) {
              const sendResponse = (fc: { id?: string; name?: string }, result: string) => {
                if (!fc.id || !fc.name) return;
                sessionPromiseRef.current?.then((s: unknown) => {
                  const sess = s as { sendToolResponse?: (x: unknown) => void };
                  sess?.sendToolResponse?.({ functionResponses: [{ id: fc.id, name: fc.name, response: { result } }] });
                });
              };
              for (const fc of fcList) {
                if (fc.name === 'update_document') {
                  const args = fc.args as { title?: string; paragraphs?: string[] };
                  const newDoc: DocumentState = {
                    title: args.title ?? docRef.current.title,
                    paragraphs: Array.isArray(args.paragraphs) ? args.paragraphs : docRef.current.paragraphs,
                  };
                  onDocumentUpdate(newDoc);
                  sendResponse(fc, 'Document updated.');
                } else if (fc.name === 'undo_last_action') {
                  const ok = onUndo();
                  sendResponse(fc, ok ? 'Undo successful.' : 'No history to undo.');
                } else if (fc.name === 'clear_document') {
                  onDocumentUpdate({ title: 'Untitled Document', paragraphs: [] });
                  sendResponse(fc, 'Document cleared.');
                } else if (fc.name === 'save_document') {
                  onSave();
                  sendResponse(fc, 'Document saved.');
                }
              }
            }
          },
          onerror: () => setStatus('ERROR'),
          onclose: () => {
            setStatus('DISCONNECTED');
            stopAllAudio();
          },
        },
      });
      sessionPromiseRef.current = sessionPromise;
      const session = await sessionPromise;
      sessionRef.current = session as { sendRealtimeInput: (x: { media: { data: string; mimeType: string } }) => void; sendToolResponse: (x: unknown) => void; close: () => void };
    } catch (err) {
      console.error('Voice connection failed:', err);
      setStatus('ERROR');
    }
  };

  const disconnect = () => {
    const s = sessionRef.current;
    if (s) {
      s.close();
      sessionRef.current = null;
    }
    audioContextRef.current?.close();
    outputAudioContextRef.current?.close();
    stopAllAudio();
    setStatus('DISCONNECTED');
  };

  return (
    <div className="absolute bottom-6 right-6 w-72 rounded-xl border border-gray-200 bg-white shadow-lg z-30 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <i className="fas fa-microphone text-emerald-600"></i>
          Voice input
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Close"
        >
          <i className="fas fa-times"></i>
        </button>
      </div>
      <div className="flex items-center gap-2">
        {status === 'CONNECTING' ? (
          <button
            type="button"
            disabled
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white opacity-50"
          >
            <i className="fas fa-spinner fa-spin"></i>
            Connecting…
          </button>
        ) : status === 'DISCONNECTED' || status === 'ERROR' ? (
          <button
            type="button"
            onClick={connect}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <i className="fas fa-microphone"></i>
            Connect
          </button>
        ) : (
          <button
            type="button"
            onClick={disconnect}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
          >
            <i className="fas fa-stop"></i>
            Disconnect
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {status === 'CONNECTING' && 'Connecting…'}
        {status === 'CONNECTED' && (isSpeaking ? 'Speaking…' : 'Listening. Say "undo", "save", or dictate.')}
        {status === 'ERROR' && 'Connection failed. Try again.'}
        {status === 'DISCONNECTED' && 'Connect to use voice.'}
      </p>
    </div>
  );
}
