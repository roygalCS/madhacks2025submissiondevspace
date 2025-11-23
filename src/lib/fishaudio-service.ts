/**
 * FishAudio Unified Service
 * Handles both Speech-to-Text (STT) and Text-to-Speech (TTS)
 * This is the ONLY voice service used in the application
 */

export interface FishAudioSTTOptions {
  apiKey: string;
  onTranscript: (text: string, isFinal: boolean) => void;
  chunkDuration?: number; // milliseconds between chunks
}

export interface FishAudioTTSOptions {
  apiKey: string;
  voiceId?: string;
  onAudioReady?: (audioUrl: string) => void;
}

export class FishAudioSTT {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private chunkInterval: NodeJS.Timeout | null = null;
  private options: FishAudioSTTOptions;
  private audioChunks: Blob[] = [];

  constructor(options: FishAudioSTTOptions) {
    this.options = {
      chunkDuration: 2000, // 2 seconds default
      ...options,
    };
  }

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.audioContext = new AudioContext();
      const mimeType = this.getOptimalMimeType();
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: 64000,
      });

      this.audioChunks = [];
      let accumulatedChunks: Blob[] = [];
      const RECORDING_DURATION = 2500;
      let recordingStartTime = Date.now();
      let isStoppingForRestart = false;

      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          accumulatedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        if (accumulatedChunks.length > 0 && this.isRecording && isStoppingForRestart) {
          const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
          const completeAudio = new Blob(accumulatedChunks, { type: mimeType });
          
          if (completeAudio.size >= 5000) {
            await this.processChunk(completeAudio, false);
          }
          
          accumulatedChunks = [];
          
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

      isStoppingForRestart = true;
      this.mediaRecorder.start();
      this.isRecording = true;

      this.chunkInterval = setInterval(async () => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          const recordingDuration = Date.now() - recordingStartTime;
          if (recordingDuration >= RECORDING_DURATION) {
            this.mediaRecorder.stop();
          }
        }
      }, 500);
    } catch (error) {
      console.error('Error starting FishAudio STT:', error);
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

      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      let finalText = '';
      if (this.audioChunks.length > 0) {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const finalBlob = new Blob(this.audioChunks, { type: mimeType });
        finalText = await this.processChunk(finalBlob, true);
      }

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
      if (!this.isRecording && !isFinal) {
        return '';
      }

      if (!audioBlob || audioBlob.size === 0 || audioBlob.size < 5000) {
        return '';
      }

      const isDevelopment = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
      const endpoint = isDevelopment ? '/api/stt' : 'https://api.fish.audio/v1/asr';

      const formData = new FormData();
      const filename = audioBlob.type.includes('webm') ? 'audio.webm' : 
                      audioBlob.type.includes('mp4') ? 'audio.mp4' : 'audio.wav';
      formData.append('file', new File([audioBlob], filename, { type: audioBlob.type }));

      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };

      if (isDevelopment) {
        headers['X-FishAudio-API-Key'] = this.options.apiKey;
      } else {
        headers['Authorization'] = `Bearer ${this.options.apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('FishAudio STT error:', response.status, errorText);
        return '';
      }

      const data = await response.json();
      const transcript = data.text || data.transcript || '';
      
      if (transcript && transcript.trim()) {
        this.options.onTranscript(transcript.trim(), isFinal);
      }

      return transcript.trim();
    } catch (error) {
      console.error('Error processing FishAudio STT chunk:', error);
      return '';
    }
  }

  private getOptimalMimeType(): string {
    const webmTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
    ];
    
    for (const type of webmTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    return '';
  }

  isActive(): boolean {
    return this.isRecording;
  }
}

// Global audio manager to prevent overlapping audio
let globalAudioManager: {
  currentAudio: HTMLAudioElement | null;
  stopAll: () => void;
} = {
  currentAudio: null,
  stopAll: () => {
    if (globalAudioManager.currentAudio) {
      globalAudioManager.currentAudio.pause();
      globalAudioManager.currentAudio.currentTime = 0;
      globalAudioManager.currentAudio = null;
    }
  }
};

export class FishAudioTTS {
  private isSpeaking = false;
  private options: FishAudioTTSOptions;
  private currentAudio: HTMLAudioElement | null = null;

  constructor(options: FishAudioTTSOptions) {
    this.options = options;
  }

  async speak(text: string): Promise<void> {
    if (!text || !text.trim()) {
      return;
    }

    globalAudioManager.stopAll();
    this.stop();

    try {
      const isDevelopment = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
      const endpoint = isDevelopment 
        ? '/api/tts'
        : 'https://api.fish.audio/v1/tts';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'model': 's1',
      };
      
      if (isDevelopment) {
        headers['X-API-Key'] = this.options.apiKey;
      } else {
        headers['Authorization'] = `Bearer ${this.options.apiKey}`;
      }

      const requestBody = {
        text: text,
        format: 'mp3',
        temperature: 0.9,
        top_p: 0.9,
        prosody: {
          speed: 1.0,
          volume: 0
        },
        ...(this.options.voiceId ? { reference_id: this.options.voiceId } : {})
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`FishAudio TTS error (${response.status}): ${errorText}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      globalAudioManager.stopAll();
      
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      globalAudioManager.currentAudio = audio;
      this.isSpeaking = true;

      audio.volume = 1.0;
      audio.muted = false;
      audio.preload = 'auto';

      return new Promise((resolve, reject) => {
        let playAttempted = false;
        
        const attemptPlay = () => {
          if (playAttempted) return;
          playAttempted = true;
          
          audio.play().then(() => {
            console.log('✅ FishAudio TTS playing');
          }).catch((playError: any) => {
            if (playError.name !== 'NotAllowedError') {
              URL.revokeObjectURL(audioUrl);
              reject(playError);
            }
          });
        };
        
        audio.onended = () => {
          this.isSpeaking = false;
          this.currentAudio = null;
          if (globalAudioManager.currentAudio === audio) {
            globalAudioManager.currentAudio = null;
          }
          if (audioUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioUrl);
          }
          resolve();
        };

        audio.onerror = (error) => {
          this.isSpeaking = false;
          this.currentAudio = null;
          if (globalAudioManager.currentAudio === audio) {
            globalAudioManager.currentAudio = null;
          }
          if (audioUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioUrl);
          }
          reject(new Error(`Audio playback error: ${audio.error?.message || 'Unknown error'}`));
        };

        audio.oncanplay = () => {
          if (!playAttempted) {
            attemptPlay();
          }
        };

        audio.oncanplaythrough = () => {
          if (!playAttempted) {
            attemptPlay();
          }
        };

        audio.onloadeddata = () => {
          if (!playAttempted && audio.readyState >= 2) {
            attemptPlay();
          }
        };

        if (audio.readyState >= 2) {
          attemptPlay();
        } else {
          audio.load();
          setTimeout(() => {
            if (!playAttempted && audio.readyState >= 2) {
              attemptPlay();
            }
          }, 500);
        }

        if (this.options.onAudioReady) {
          this.options.onAudioReady(audioUrl);
        }
      });
    } catch (error) {
      console.error('Error with FishAudio TTS:', error);
      throw error;
    }
  }

  stop(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        if (globalAudioManager.currentAudio === this.currentAudio) {
          globalAudioManager.currentAudio = null;
        }
        this.currentAudio = null;
      } catch (error) {
        console.warn('Error stopping audio:', error);
      }
    }
    
    this.isSpeaking = false;
  }

  interrupt(): void {
    this.stop();
  }

  isActive(): boolean {
    return this.isSpeaking;
  }
}

