/**
 * Real-time Speech-to-Text using Deepgram
 * Processes audio in chunks for lower latency
 */

import { convertToWav } from './audio-converter';

export interface RealtimeSTTOptions {
  apiKey: string;
  onTranscript: (text: string, isFinal: boolean) => void;
  chunkDuration?: number; // milliseconds between chunks
  apiEndpoint?: string; // Optional custom endpoint
}

export class RealtimeSTT {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private chunkInterval: NodeJS.Timeout | null = null;
  private options: RealtimeSTTOptions;
  private audioChunks: Blob[] = [];

  constructor(options: RealtimeSTTOptions) {
    this.options = {
      chunkDuration: 2000, // 2 seconds default
      ...options,
    };
  }

  async start(): Promise<void> {
    try {
      // Get user's microphone
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // Create audio context for processing
      this.audioContext = new AudioContext();

      // Create MediaRecorder with optimal settings for low latency
      // Inspired by FaceTimeOS: prioritize low latency over quality for real-time feel
      const mimeType = this.getOptimalMimeType();
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: 64000, // Lower bitrate for faster processing (FaceTimeOS pattern)
      });

      this.audioChunks = [];
      let accumulatedChunks: Blob[] = [];
      // Stop and restart MediaRecorder to get complete files instead of fragments
      const RECORDING_DURATION = 2500; // Record for 2.5 seconds (reduced from 4s for faster response)
      let recordingStartTime = Date.now();
      let isStoppingForRestart = false; // Flag to distinguish between restart and final stop

      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          accumulatedChunks.push(event.data);
        }
      };

      // Stop recording periodically to get complete files
      this.mediaRecorder.onstop = async () => {
        if (accumulatedChunks.length > 0 && this.isRecording && isStoppingForRestart) {
          const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
          const completeAudio = new Blob(accumulatedChunks, { type: mimeType });
          
          if (completeAudio.size >= 5000) {
            console.log(`📤 Sending complete audio file: ${completeAudio.size} bytes`);
            await this.processChunk(completeAudio, false);
          }
          
          // Clear chunks for next recording
          accumulatedChunks = [];
          
          // Restart recording if still active
          if (this.isRecording && this.mediaRecorder && this.stream) {
            try {
              isStoppingForRestart = true;
              this.mediaRecorder.start();
              recordingStartTime = Date.now();
            } catch (e) {
              console.error('Error restarting MediaRecorder:', e);
            }
          }
        }
      };

      // Start recording - will stop automatically after RECORDING_DURATION
      isStoppingForRestart = true;
      this.mediaRecorder.start();
      this.isRecording = true;

      // Stop and restart MediaRecorder periodically to get complete files
      this.chunkInterval = setInterval(async () => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          const recordingDuration = Date.now() - recordingStartTime;
          if (recordingDuration >= RECORDING_DURATION) {
            console.log(`⏹️ Stopping MediaRecorder to get complete file (${(recordingDuration / 1000).toFixed(1)}s)`);
            this.mediaRecorder.stop();
            // onstop handler will restart it
          }
        }
      }, 500); // Check every 500ms
    } catch (error) {
      console.error('Error starting real-time STT:', error);
      throw error;
    }
  }

  async stop(): Promise<string> {
    return new Promise(async (resolve) => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve('');
        return;
      }

      this.isRecording = false;

      if (this.chunkInterval) {
        clearInterval(this.chunkInterval);
        this.chunkInterval = null;
      }

      // Set flag to prevent restart
      const wasStoppingForRestart = (this.mediaRecorder as any).isStoppingForRestart;
      (this.mediaRecorder as any).isStoppingForRestart = false;

      // Stop the current recording to get final complete file
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }

      // Wait a bit for the onstop handler to process
      await new Promise(resolve => setTimeout(resolve, 500));

      // Process any remaining chunks
      let finalText = '';
      if (this.audioChunks.length > 0) {
        // Use the same MIME type that was used for recording
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const finalBlob = new Blob(this.audioChunks, { type: mimeType });
        finalText = await this.processChunk(finalBlob, true);
      }

      // Cleanup
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }

      this.mediaRecorder = null;
      resolve(finalText);
    });
  }


  private async processChunk(audioBlob: Blob, isFinal = false): Promise<string> {
    try {
      // Skip if not recording (prevents retry loops)
      if (!this.isRecording && !isFinal) {
        return '';
      }

      // Validate audio blob - skip if empty or too small
      if (!audioBlob || audioBlob.size === 0) {
        console.warn('Empty audio blob, skipping STT request');
        return '';
      }
      
      // Deepgram needs complete, valid audio files
      // Minimum size to ensure valid audio
      if (audioBlob.size < 5000) {
        console.warn('Audio blob too small (' + audioBlob.size + ' bytes), skipping STT request (need at least 5KB for valid audio file)');
        return '';
      }

      // Deepgram supports many formats natively (WebM, MP4, WAV, etc.)
      // Try sending original format first - Deepgram handles conversion better than we do
      let audioToSend: Blob = audioBlob;
      let filename = 'audio';
      let mimeType = audioBlob.type || 'audio/webm';
      
      // Determine filename extension based on MIME type
      if (mimeType.includes('webm')) {
        filename = 'audio.webm';
      } else if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
        filename = 'audio.mp4';
      } else if (mimeType.includes('wav')) {
        filename = 'audio.wav';
      } else if (mimeType.includes('ogg')) {
        filename = 'audio.ogg';
      } else {
        filename = 'audio.webm'; // Default to webm
        mimeType = 'audio/webm';
      }
      
      // Check if it's a fragmented MP4 (not supported by Deepgram)
      if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
        try {
          const firstBytes = await audioBlob.slice(0, 8).arrayBuffer();
          const header = new Uint8Array(firstBytes);
          const isFragmented = header[4] === 0x6d && header[5] === 0x6f && 
                              header[6] === 0x6f && header[7] === 0x66; // "moof"
          
          if (isFragmented) {
            console.warn('⚠️ Fragmented MP4 detected, converting to WAV...');
            // Convert fragmented MP4 to WAV
            try {
              audioToSend = await convertToWav(audioBlob);
              filename = 'audio.wav';
              mimeType = 'audio/wav';
            } catch (conversionError) {
              console.error('❌ Failed to convert fragmented MP4:', conversionError);
              return '';
            }
          }
        } catch (e) {
          // Couldn't check, try sending as-is
          console.warn('⚠️ Could not verify MP4 format, sending as-is');
        }
      }
      
      console.log('📊 Processing STT chunk:', {
        originalSize: audioBlob.size,
        originalType: audioBlob.type,
        sendingSize: audioToSend.size,
        sendingType: mimeType,
        filename: filename,
        wasConverted: audioBlob !== audioToSend
      });

      // Ensure we have a valid audio file before sending
      if (audioToSend.size < 1000) {
        console.warn('⚠️ Audio blob too small, skipping:', {
          type: mimeType,
          size: audioToSend.size
        });
        return '';
      }

      // Deepgram API endpoint
      const endpoint = this.options.apiEndpoint || '/api/stt';
      
      // Deepgram API requires multipart/form-data with audio file
      const formData = new FormData();
      const audioFile = new File([audioToSend], filename, { type: mimeType });
      
      // Deepgram API field name is 'file'
      formData.append('file', audioFile);
      
      const requestBody = formData;

      // Log request details for debugging
      console.log('📤 Sending STT request to Deepgram:', {
        blobSize: audioToSend.size,
        blobType: mimeType,
        filename: filename,
        fileType: audioFile.type,
        fileSize: audioFile.size,
        apiKeyPresent: !!this.options.apiKey,
        apiKeyLength: this.options.apiKey?.length || 0,
        endpoint: endpoint,
        format: 'multipart/form-data'
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        // Don't set Content-Type - let browser set multipart boundary
        headers: {
          'Authorization': `Token ${this.options.apiKey}`,
          'Accept': 'application/json',
        },
        body: requestBody,
      });

      if (!response.ok) {
        // Get error details for debugging
        let errorText = '';
        let errorJson: any = null;
        try {
          errorText = await response.text();
          console.error('❌ STT API error response:', response.status, errorText);
          
          // Try to parse as JSON for more details
          try {
            errorJson = JSON.parse(errorText);
            console.error('❌ STT API error details:', JSON.stringify(errorJson, null, 2));
          } catch (e) {
            // Not JSON, log as text
            console.error('❌ STT API error (plain text):', errorText);
          }
          
          // Log response headers for debugging
          console.error('❌ Response headers:', Object.fromEntries(response.headers.entries()));
        } catch (e) {
          console.error('STT API error (could not read response):', response.status, response.statusText);
        }
        
        // Log request details for debugging
        console.error('🔍 Request debugging info:', {
          endpoint: '/api/stt',
          method: 'POST',
          blobSize: audioToSend.size,
          blobType: mimeType,
          filename: filename,
          hasApiKey: !!this.options.apiKey,
          responseStatus: response.status,
          responseStatusText: response.statusText,
          errorMessage: errorJson?.message || errorText
        });
        
        // Don't retry on client errors (400-499) or server errors (500+)
        if (response.status >= 400) {
          console.warn('STT chunk processing failed:', response.status, response.statusText, errorText);
          // If it's a 500 error, stop processing to prevent infinite retries
          if (response.status >= 500) {
            console.error('STT server error - stopping processing to prevent retry loop. Error:', errorText);
            this.isRecording = false;
            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
              this.mediaRecorder.stop();
            }
          }
          return '';
        }
        return '';
      }

      const data = await response.json();
      
      // Deepgram API response format: { results: { channels: [{ alternatives: [{ transcript: "..." }] }] }] }
      let transcript = '';
      if (data.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
        transcript = data.results.channels[0].alternatives[0].transcript;
      } else if (data.text) {
        // Fallback for different response format
        transcript = data.text;
      }
      
      if (transcript && transcript.trim()) {
        this.options.onTranscript(transcript.trim(), isFinal);
      }

      return transcript.trim();
    } catch (error) {
      console.error('Error processing STT chunk:', error);
      // Stop recording on network errors to prevent retry loops
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('Network error - stopping STT processing');
        this.isRecording = false;
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      }
      return '';
    }
  }

  private getOptimalMimeType(): string {
    // Force WebM format for all browsers - we can decode it and convert to WAV
    // Fragmented MP4 from Safari can't be decoded, so WebM is more reliable
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    // Try WebM first even on Safari - if it works, we can convert it
    // If not, fall back to Safari's native formats
    const webmTypes = [
      'audio/webm;codecs=opus',  // Preferred WebM with Opus
      'audio/webm',              // Fallback WebM
    ];
    
    for (const type of webmTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('✅ Using WebM format (will convert to WAV):', type);
        return type;
      }
    }
    
    // If WebM not supported (unlikely), fall back to browser defaults
    if (isSafari) {
      const safariTypes = [
        'audio/mp4',           // Safari's preferred format (AAC codec)
        'audio/aac',           // Direct AAC
        'audio/m4a',           // M4A container
      ];
      
      for (const type of safariTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          console.warn('⚠️ Safari: Using MP4 format (may be fragmented, conversion may fail):', type);
          return type;
        }
      }
    }
    
    // Last resort: browser default
    console.warn('⚠️ No preferred format supported, using browser default');
    return ''; // Use browser default
  }

  isActive(): boolean {
    return this.isRecording;
  }
}

