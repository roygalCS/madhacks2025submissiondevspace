/**
 * Audio format conversion utilities
 * Converts audio formats to WAV for Deepgram STT
 * Deepgram works best with WAV format (PCM)
 */

/**
 * Helper to get first N bytes of a blob for debugging
 */
async function getFirstBytes(blob: Blob, count: number): Promise<string> {
  const slice = blob.slice(0, count);
  const arrayBuffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  return Array.from(bytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
}

/**
 * Convert any audio blob to WAV format using Web Audio API
 * @param audioBlob - The audio blob to convert
 * @returns Promise<Blob> - WAV format blob
 */
export async function convertToWav(audioBlob: Blob): Promise<Blob> {
  try {
    // Check if it's already WAV
    const isWav = audioBlob.type.includes('wav') || audioBlob.type === 'audio/wav';
    
    if (isWav) {
      // Verify it's actually a valid WAV file by checking the header
      try {
        const firstBytes = await getFirstBytes(audioBlob, 4);
        const headerBytes = firstBytes.split(' ').map(b => parseInt(b.replace('0x', ''), 16));
        const isValidWav = headerBytes[0] === 0x52 && headerBytes[1] === 0x49 && 
                           headerBytes[2] === 0x46 && headerBytes[3] === 0x46; // "RIFF"
        
        if (isValidWav) {
          console.log('✅ Audio is already valid WAV format');
          return audioBlob;
        } else {
          console.warn('⚠️ Audio claims to be WAV but header is invalid, converting anyway');
        }
      } catch (e) {
        console.warn('⚠️ Could not verify WAV header, converting anyway:', e);
      }
    }
    
    // Check if it's MP4/M4A - these are problematic because MediaRecorder creates fragments
    const isMp4 = audioBlob.type.includes('mp4') || audioBlob.type.includes('m4a');
    
    if (isMp4) {
      // Check if it's a fragmented MP4 (starts with "moof" atom)
      const firstBytes = await getFirstBytes(audioBlob, 8);
      const headerBytes = firstBytes.split(' ').map(b => parseInt(b.replace('0x', ''), 16));
      const isFragmented = headerBytes[4] === 0x6d && headerBytes[5] === 0x6f && 
                          headerBytes[6] === 0x6f && headerBytes[7] === 0x66; // "moof"
      
      if (isFragmented) {
        console.error('❌ Fragmented MP4 detected - cannot decode or send to FishAudio');
        console.error('❌ Fragmented MP4 is not a valid standalone file format');
        console.error('💡 Solution: Use WebM format instead (we can decode and convert it)');
        throw new Error('Fragmented MP4 cannot be processed. Please use WebM format.');
      } else {
        console.log('✅ Complete MP4 file detected, will try to convert to WAV');
      }
    }
    
    console.log('🔄 Audio is NOT WAV format, will convert:', audioBlob.type || '(unknown type)');
    
    // Convert everything else to WAV for Deepgram
    console.log('🔄 Converting audio to WAV format for Deepgram (16kHz, mono, 16-bit)...');
    console.log('📦 Input blob details:', {
      size: audioBlob.size,
      type: audioBlob.type || '(empty/unknown type)',
      firstBytes: await getFirstBytes(audioBlob, 16)
    });

    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    console.log('🎵 AudioContext created, sample rate:', audioContext.sampleRate);
    
    // Decode audio data
    const arrayBuffer = await audioBlob.arrayBuffer();
    console.log('🎵 Decoding audio data, arrayBuffer size:', arrayBuffer.byteLength);
    
    let audioBuffer: AudioBuffer;
    try {
      console.log('🔄 Calling decodeAudioData...');
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0)); // Create a copy to avoid issues
      console.log('✅ Audio decoded successfully:', {
        duration: audioBuffer.duration.toFixed(2) + 's',
        sampleRate: audioBuffer.sampleRate + 'Hz',
        numberOfChannels: audioBuffer.numberOfChannels,
        length: audioBuffer.length + ' samples'
      });
    } catch (decodeError) {
      console.error('❌ Failed to decode audio:', decodeError);
      console.error('❌ Decode error details:', {
        error: decodeError instanceof Error ? decodeError.message : String(decodeError),
        blobType: audioBlob.type,
        blobSize: audioBlob.size,
        arrayBufferSize: arrayBuffer.byteLength
      });
      throw new Error(`Failed to decode audio: ${decodeError instanceof Error ? decodeError.message : String(decodeError)}`);
    }

    // Convert to WAV - Deepgram works best with 16kHz, mono, 16-bit PCM
    // Resample and convert to mono if needed
    const targetSampleRate = 16000; // Deepgram recommended
    const targetChannels = 1; // Mono recommended
    
    let processedBuffer = audioBuffer;
    
    // Resample if needed
    if (audioBuffer.sampleRate !== targetSampleRate) {
      processedBuffer = await resampleAudioBuffer(audioBuffer, targetSampleRate);
    }
    
    // Convert to mono if needed
    if (processedBuffer.numberOfChannels > targetChannels) {
      processedBuffer = convertToMono(processedBuffer);
    }
    
    // Convert to WAV (16-bit PCM)
    const wavBuffer = audioBufferToWav(processedBuffer);
    const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

    // Verify WAV header
    const wavHeader = new Uint8Array(wavBuffer.slice(0, 12));
    const isValidWav = wavHeader[0] === 0x52 && wavHeader[1] === 0x49 && wavHeader[2] === 0x46 && wavHeader[3] === 0x46; // "RIFF"
    
    console.log('✅ Converted to WAV for Deepgram:', {
      size: wavBlob.size,
      isValid: isValidWav,
      sampleRate: processedBuffer.sampleRate + 'Hz',
      channels: processedBuffer.numberOfChannels,
      format: '16-bit PCM',
      header: Array.from(wavHeader.slice(0, 12)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')
    });
    
    if (!isValidWav) {
      console.error('❌ WAV file validation failed!');
    }
    
    // Verify Deepgram recommendations
    if (processedBuffer.sampleRate !== 16000) {
      console.warn('⚠️ Warning: Sample rate is ' + processedBuffer.sampleRate + 'Hz, Deepgram recommends 16kHz');
    }
    if (processedBuffer.numberOfChannels !== 1) {
      console.warn('⚠️ Warning: Audio has ' + processedBuffer.numberOfChannels + ' channels, Deepgram recommends mono');
    }
    
    // Close audio context
    await audioContext.close();

    return wavBlob;
  } catch (error) {
    console.error('❌ Error converting audio to WAV:', error);
    console.error('❌ Conversion error details:', {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      blobType: audioBlob.type,
      blobSize: audioBlob.size
    });
    
    // Don't fall back to original - FishAudio STT is very picky about formats
    // If conversion fails, we should fail the request rather than send unsupported format
    throw new Error(`Failed to convert audio to WAV: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Resample AudioBuffer to target sample rate
 */
async function resampleAudioBuffer(buffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
  if (buffer.sampleRate === targetSampleRate) {
    return buffer;
  }
  
  const ratio = buffer.sampleRate / targetSampleRate;
  const newLength = Math.round(buffer.length / ratio);
  const offlineContext = new OfflineAudioContext(
    buffer.numberOfChannels,
    newLength,
    targetSampleRate
  );
  
  const source = offlineContext.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineContext.destination);
  source.start();
  
  return await offlineContext.startRendering();
}

/**
 * Convert multi-channel AudioBuffer to mono
 */
function convertToMono(buffer: AudioBuffer): AudioBuffer {
  if (buffer.numberOfChannels === 1) {
    return buffer;
  }
  
  // Create mono buffer using OfflineAudioContext to avoid creating new AudioContext
  // We'll manually create the buffer data
  const monoData = new Float32Array(buffer.length);
  
  // Average all channels into mono
  for (let i = 0; i < buffer.length; i++) {
    let sum = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      sum += buffer.getChannelData(channel)[i];
    }
    monoData[i] = sum / buffer.numberOfChannels;
  }
  
  // Create new AudioBuffer with mono data
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const monoBuffer = audioContext.createBuffer(1, buffer.length, buffer.sampleRate);
  monoBuffer.getChannelData(0).set(monoData);
  
  return monoBuffer;
}

/**
 * Convert AudioBuffer to WAV file format (16-bit PCM, recommended for Deepgram)
 * @param buffer - AudioBuffer to convert (should be 16kHz, mono for best results)
 * @returns ArrayBuffer - WAV file data
 */
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const length = buffer.length;
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numberOfChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format (1 = PCM)
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Convert float samples to 16-bit PCM (interleaved)
  // WAV format requires interleaved samples: [L, R, L, R, ...] for stereo
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      // Convert float (-1 to 1) to 16-bit integer (-32768 to 32767)
      const intSample = sample < 0 ? Math.max(-32768, Math.floor(sample * 32768)) : Math.min(32767, Math.floor(sample * 32767));
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

