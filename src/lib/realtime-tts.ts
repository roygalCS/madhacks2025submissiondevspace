/**
 * Real-time Text-to-Speech using Web Speech API
 * Falls back to FishAudio TTS if Web Speech API is not available
 */

export interface RealtimeTTSOptions {
  fishAudioApiKey?: string;
  voiceId?: string;
  onAudioReady?: (audioUrl: string) => void;
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

export class RealtimeTTS {
  private synthesis: SpeechSynthesis | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private isSpeaking = false;
  private options: RealtimeTTSOptions;
  private useWebSpeech = false;
  private currentAudio: HTMLAudioElement | null = null; // Store current audio element

  constructor(options: RealtimeTTSOptions = {}) {
    this.options = options;
    this.synthesis = typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis
      : null;
    
    // Prioritize FishAudio over Web Speech API for better quality
    // Only use Web Speech if FishAudio is not available
    this.useWebSpeech = this.synthesis !== null && !options.fishAudioApiKey;
  }

  async speak(text: string): Promise<void> {
    if (!text || !text.trim()) {
      console.warn('⚠️ TTS: Empty text provided');
      return;
    }

    console.log('🎤 TTS.speak called:', {
      textLength: text.length,
      useWebSpeech: this.useWebSpeech,
      hasFishAudioKey: !!this.options.fishAudioApiKey,
      voiceId: this.options.voiceId
    });

    // Stop ALL audio globally to prevent overlapping
    globalAudioManager.stopAll();
    this.stop();

    // Prioritize FishAudio for better quality
    if (this.options.fishAudioApiKey) {
      // Use FishAudio TTS (preferred)
      console.log('🔊 Using FishAudio TTS (preferred)');
      return this.speakWithFishAudio(text);
    } else if (this.useWebSpeech && this.synthesis) {
      // Fallback to Web Speech API if FishAudio not available
      console.log('🔊 Using Web Speech API for TTS (fallback)');
      return this.speakWithWebSpeech(text);
    } else {
      console.error('❌ No TTS method available - FishAudio key:', !!this.options.fishAudioApiKey, 'Web Speech:', this.useWebSpeech);
      throw new Error('No TTS method available. Please configure VITE_FISHAUDIO_API_KEY in your .env file.');
    }
  }

  private speakWithWebSpeech(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject(new Error('Speech synthesis not available'));
        return;
      }

      this.utterance = new SpeechSynthesisUtterance(text);
      
      // Configure voice
      const voices = this.synthesis.getVoices();
      const preferredVoice = voices.find(voice => 
        voice.name.includes('Male') || 
        voice.name.includes('Google') ||
        voice.lang.startsWith('en')
      ) || voices[0];

      if (preferredVoice) {
        this.utterance.voice = preferredVoice;
      }

      this.utterance.rate = 1.0;
      this.utterance.pitch = 1.0;
      this.utterance.volume = 1.0;

      this.utterance.onend = () => {
        this.isSpeaking = false;
        resolve();
      };

      this.utterance.onerror = (error) => {
        this.isSpeaking = false;
        reject(error);
      };

      this.isSpeaking = true;
      this.synthesis.speak(this.utterance);
    });
  }

  private async speakWithFishAudio(text: string): Promise<void> {
    try {
      const isDevelopment = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
      const endpoint = isDevelopment 
        ? '/api/tts'
        : 'https://api.fish.audio/v1/tts';

      if (!this.options.fishAudioApiKey) {
        throw new Error('FishAudio API key is not configured');
      }

      // FishAudio API format according to official docs
      // Headers: Authorization Bearer + model header
      // Body: JSON with text, format, temperature, top_p, prosody, etc.
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'model': 's1', // Required model header
      };
      
      if (isDevelopment) {
        // For proxy, use X-API-Key (proxy will transform to Authorization Bearer)
        headers['X-API-Key'] = this.options.fishAudioApiKey;
      } else {
        // For direct calls, use Authorization Bearer
        headers['Authorization'] = `Bearer ${this.options.fishAudioApiKey}`;
      }

      // FishAudio request body format (reference_id is optional, format defaults to mp3)
      const requestBody = {
        text: text,
        format: 'mp3', // mp3, wav, pcm, or opus
        temperature: 0.9,
        top_p: 0.9,
        prosody: {
          speed: 1.0,
          volume: 0
        },
        // reference_id is optional - only include if voiceId is provided
        ...(this.options.voiceId ? { reference_id: this.options.voiceId } : {})
      };

      console.log('🎵 FishAudio TTS request:', {
        endpoint,
        hasApiKey: !!this.options.fishAudioApiKey,
        apiKeyLength: this.options.fishAudioApiKey.length,
        isDevelopment,
        textLength: text.length,
        voiceId: this.options.voiceId,
        requestBody: { ...requestBody, text: text.substring(0, 50) + '...' }
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      const contentType = response.headers.get('content-type') || '';
      
      console.log('🎵 FishAudio TTS response:', {
        status: response.status,
        statusText: response.statusText,
        contentType: contentType,
        contentLength: response.headers.get('content-length')
      });

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
          const errorJson = JSON.parse(errorText);
          console.error('❌ FishAudio TTS error:', { 
            status: response.status, 
            error: errorJson.error,
            details: errorJson.details,
            code: errorJson.code
          });
          throw new Error(`FishAudio TTS error (${response.status}): ${errorJson.error || errorText}`);
        } catch (parseError) {
          console.error('❌ FishAudio TTS error (could not parse):', { 
            status: response.status, 
            errorText 
          });
          throw new Error(`TTS API error: ${response.status} - ${errorText || response.statusText}`);
        }
      }

      // FishAudio returns binary audio data directly (not JSON with URL)
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      console.log('🎵 FishAudio returned audio blob:', { 
        size: audioBlob.size, 
        type: audioBlob.type,
        contentType: contentType,
        url: audioUrl.substring(0, 50) + '...'
      });

      // Stop any currently playing audio globally first
      globalAudioManager.stopAll();
      
      // Play audio
      const audio = new Audio(audioUrl);
      this.currentAudio = audio; // Store reference to prevent garbage collection
      globalAudioManager.currentAudio = audio; // Register with global manager
      this.isSpeaking = true;

      // Explicitly configure audio for playback
      audio.volume = 1.0;
      audio.muted = false; // Explicitly unmute (some browsers default to muted)
      audio.preload = 'auto';

      console.log('🔊 Playing FishAudio TTS audio...', {
        audioUrl: audioUrl.substring(0, 50) + '...',
        audioReadyState: audio.readyState,
        volume: audio.volume,
        muted: audio.muted
      });

      return new Promise((resolve, reject) => {
        
        let playAttempted = false;
        
        const attemptPlay = () => {
          if (playAttempted) return;
          playAttempted = true;
          
          console.log('▶️ Attempting to play audio...', {
            readyState: audio.readyState,
            networkState: audio.networkState,
            paused: audio.paused
          });
          
          audio.play().then(() => {
            console.log('✅ FishAudio TTS audio.play() succeeded');
            // Verify audio is actually playing
            setTimeout(() => {
              if (audio.paused) {
                console.warn('⚠️ Audio is paused after play() - may be blocked by browser');
              } else {
                console.log('✅ Audio is playing, volume:', audio.volume, 'muted:', audio.muted);
              }
            }, 100);
          }).catch((playError: any) => {
            console.error('❌ FishAudio TTS audio.play() failed:', playError);
            console.error('❌ Play error details:', {
              name: playError.name,
              message: playError.message,
              code: playError.code,
              error: playError
            });
            
            // If it's a NotAllowedError (autoplay blocked), try to show a helpful message
            if (playError.name === 'NotAllowedError') {
              console.error('🚫 Browser blocked autoplay. User interaction may be required.');
              // Don't reject - just log, audio might play on next interaction
            } else {
              // Clean up object URL
              if (audioUrl.startsWith('blob:')) {
                URL.revokeObjectURL(audioUrl);
              }
              reject(playError);
            }
          });
        };
        
        audio.onended = () => {
          console.log('✅ FishAudio TTS playback completed');
          this.isSpeaking = false;
          this.currentAudio = null; // Clear reference
          if (globalAudioManager.currentAudio === audio) {
            globalAudioManager.currentAudio = null; // Clear global reference
          }
          // Clean up object URL if it was created from blob
          if (audioUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioUrl);
          }
          resolve();
        };

        audio.onerror = (error) => {
          console.error('❌ FishAudio TTS playback error:', error);
          console.error('❌ Audio error details:', {
            error: audio.error,
            networkState: audio.networkState,
            readyState: audio.readyState,
            src: audio.src,
            volume: audio.volume,
            muted: audio.muted
          });
          this.isSpeaking = false;
          this.currentAudio = null; // Clear reference
          if (globalAudioManager.currentAudio === audio) {
            globalAudioManager.currentAudio = null; // Clear global reference
          }
          // Clean up object URL
          if (audioUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioUrl);
          }
          reject(new Error(`Audio playback error: ${audio.error?.message || 'Unknown error'}`));
        };

        audio.onplay = () => {
          console.log('▶️ FishAudio TTS audio started playing');
        };

        audio.oncanplay = () => {
          console.log('✅ FishAudio TTS audio can play, readyState:', audio.readyState);
          if (!playAttempted) {
            attemptPlay();
          }
        };

        audio.oncanplaythrough = () => {
          console.log('✅ FishAudio TTS audio can play through');
          if (!playAttempted) {
            attemptPlay();
          }
        };

        audio.onloadeddata = () => {
          console.log('✅ FishAudio TTS audio loaded data');
          if (!playAttempted && audio.readyState >= 2) {
            attemptPlay();
          }
        };

        // Try to play immediately if ready
        if (audio.readyState >= 2) { // HAVE_CURRENT_DATA
          console.log('✅ Audio already ready, playing immediately');
          attemptPlay();
        } else {
          // Wait for audio to load
          console.log('⏳ Waiting for audio to load, readyState:', audio.readyState);
          audio.load();
          
          // Fallback: try to play after a short delay
          setTimeout(() => {
            if (!playAttempted && audio.readyState >= 2) {
              console.log('⏰ Fallback: attempting to play after timeout');
              attemptPlay();
            }
          }, 500);
        }

        if (this.options.onAudioReady) {
          this.options.onAudioReady(audioUrl);
        }
      });
    } catch (error) {
      console.error('❌ Error with FishAudio TTS:', error);
      throw error;
    }
  }

  stop(): void {
    if (this.useWebSpeech && this.synthesis) {
      this.synthesis.cancel();
      // Clear any pending utterances
      if (this.utterance) {
        this.utterance.onend = null;
        this.utterance.onerror = null;
        this.utterance = null;
      }
    }
    
    // Stop and clean up audio element
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

  /**
   * Interrupt current speech immediately
   */
  interrupt(): void {
    this.stop();
  }

  isActive(): boolean {
    return this.isSpeaking;
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synthesis) {
      return [];
    }
    return this.synthesis.getVoices();
  }
}

