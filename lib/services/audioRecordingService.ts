/**
 * Service for handling audio recording and upload to Azure Blob Storage
 */

import { uploadAudioBlob, getBlobUrl } from './azureBlobService';

export interface AudioChunk {
  blob: Blob;
  sender: 'user' | 'ai';
  timestamp: number;
  messageIndex?: number;
}

// Generate blob name with best naming convention
export function generateBlobName(
  sessionId: number,
  type: 'session' | 'message',
  sender?: 'user' | 'ai',
  messageIndex?: number
): string {
  const timestamp = Date.now();
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  if (type === 'session') {
    return `sessions/${sessionId}/combined-${timestamp}.webm`;
  } else {
    return `sessions/${sessionId}/messages/${messageIndex}-${sender}-${timestamp}.${sender === 'ai' ? 'wav' : 'webm'}`;
  }
}

export async function uploadSessionAudio(
  sessionId: number,
  audioBlob: Blob
): Promise<string | null> {
  try {
    console.log(`[uploadSessionAudio] Starting upload for session ${sessionId}, blob size: ${audioBlob.size} bytes`);
    const blobName = generateBlobName(sessionId, 'session');
    console.log(`[uploadSessionAudio] Generated blob name: ${blobName}`);
    const blobUrl = await uploadAudioBlob(blobName, audioBlob, 'audio/webm');
    console.log(`[uploadSessionAudio] Upload result: ${blobUrl ? 'SUCCESS' : 'FAILED'}, URL: ${blobUrl}`);
    return blobUrl; // Store this permanent URL in database
  } catch (error) {
    console.error('[uploadSessionAudio] Error uploading session audio:', error);
    return null;
  }
}

export async function uploadMessageAudio(
  sessionId: number,
  audioBlob: Blob,
  sender: 'user' | 'ai',
  messageIndex: number
): Promise<string | null> {
  try {
    console.log(`[uploadMessageAudio] Starting upload for session ${sessionId}, message ${messageIndex}, sender ${sender}, blob size: ${audioBlob.size} bytes`);
    const contentType = sender === 'ai' ? 'audio/wav' : 'audio/webm';
    const blobName = generateBlobName(sessionId, 'message', sender, messageIndex);
    console.log(`[uploadMessageAudio] Generated blob name: ${blobName}`);
    const blobUrl = await uploadAudioBlob(blobName, audioBlob, contentType);
    console.log(`[uploadMessageAudio] Upload result: ${blobUrl ? 'SUCCESS' : 'FAILED'}, URL: ${blobUrl}`);
    return blobUrl; // Store this permanent URL in database
  } catch (error) {
    console.error('[uploadMessageAudio] Error uploading message audio:', error);
    return null;
  }
}

export function createAudioRecorder(stream: MediaStream): MediaRecorder | null {
  try {
    const options = { mimeType: 'audio/webm;codecs=opus' };
    const recorder = new MediaRecorder(stream, options);
    return recorder;
  } catch (error) {
    console.error('Error creating MediaRecorder:', error);
    return null;
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
