/**
 * Utility functions for encoding AudioBuffer to WAV format
 */

/**
 * Encode AudioBuffer to WAV format Blob
 */
export function encodeAudioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  
  // Create WAV file header
  const buffer = new ArrayBuffer(44 + length * numChannels * 2);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * numChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
  view.setUint16(32, numChannels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, length * numChannels * 2, true);
  
  // Convert float samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Combine multiple AudioBuffers into a single AudioBuffer
 * All buffers must have the same sample rate and number of channels
 */
export function combineAudioBuffers(buffers: AudioBuffer[]): AudioBuffer | null {
  if (buffers.length === 0) return null;
  if (buffers.length === 1) return buffers[0];

  const firstBuffer = buffers[0];
  const sampleRate = firstBuffer.sampleRate;
  const numChannels = firstBuffer.numberOfChannels;

  // Verify all buffers have the same sample rate and channels
  for (const buffer of buffers) {
    if (buffer.sampleRate !== sampleRate || buffer.numberOfChannels !== numChannels) {
      console.error('Cannot combine buffers with different sample rates or channel counts');
      return null;
    }
  }

  // Calculate total length
  const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);

  // Create a new AudioContext to create the combined buffer
  // Note: We'll use the sample rate from the first buffer
  const ctx = new OfflineAudioContext(numChannels, totalLength, sampleRate);
  const combinedBuffer = ctx.createBuffer(numChannels, totalLength, sampleRate);

  // Copy data from all buffers into the combined buffer
  let offset = 0;
  for (const buffer of buffers) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sourceData = buffer.getChannelData(channel);
      const destData = combinedBuffer.getChannelData(channel);
      destData.set(sourceData, offset);
    }
    offset += buffer.length;
  }

  return combinedBuffer;
}

/**
 * Encode multiple AudioBuffers into a single WAV file
 * This combines the buffers first, then adds a single WAV header
 */
export function encodeAudioBuffersToWav(buffers: AudioBuffer[]): Blob | null {
  if (buffers.length === 0) return null;

  const combinedBuffer = combineAudioBuffers(buffers);
  if (!combinedBuffer) return null;

  return encodeAudioBufferToWav(combinedBuffer);
}
