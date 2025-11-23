/**
 * Ready Player Me Avatar Service
 * Provides real-time 3D avatar rendering with lip sync
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface AvatarConfig {
  avatarUrl: string; // Ready Player Me avatar GLB URL
  container: HTMLDivElement;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export class ReadyPlayerMeAvatar {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private avatar: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private clock: THREE.Clock;
  private isSpeaking: boolean = false;
  private lipSyncData: Float32Array | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private animationFrameId: number | null = null;

  constructor(private config: AvatarConfig) {
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      50,
      config.container.clientWidth / config.container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.6, 2);
    this.camera.lookAt(0, 1.6, 0);

    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(config.container.clientWidth, config.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    config.container.appendChild(this.renderer.domElement);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // Handle window resize
    window.addEventListener('resize', this.handleResize.bind(this));

    // Load avatar
    this.loadAvatar();
  }

  private handleResize() {
    const width = this.config.container.clientWidth;
    const height = this.config.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private async loadAvatar() {
    try {
      const loader = new GLTFLoader();
      
      // Add error handling for CORS and network issues
      loader.setRequestHeader({});
      
      const gltf = await loader.loadAsync(
        this.config.avatarUrl,
        (progress) => {
          // Optional: track loading progress
          if (progress.total > 0) {
            const percent = (progress.loaded / progress.total) * 100;
            console.log(`Loading avatar: ${percent.toFixed(0)}%`);
          }
        }
      );

      // Remove existing avatar if any
      if (this.avatar) {
        this.scene.remove(this.avatar);
      }

      this.avatar = gltf.scene;
      this.scene.add(this.avatar);

      // Setup animations if available
      if (gltf.animations && gltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(this.avatar);
        gltf.animations.forEach((clip) => {
          this.mixer!.clipAction(clip).play();
        });
      }

      // Center and scale avatar
      const box = new THREE.Box3().setFromObject(this.avatar);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 1.8 / maxDim;
      
      this.avatar.scale.multiplyScalar(scale);
      this.avatar.position.sub(center.multiplyScalar(scale));
      this.avatar.position.y = 0;

      this.startRenderLoop();
      this.config.onLoad?.();
    } catch (error) {
      console.error('Error loading Ready Player Me avatar:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Provide helpful error messages
      if (errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch')) {
        console.warn('CORS error loading avatar. The avatar URL may need CORS headers.');
      }
      
      this.config.onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }

  private startRenderLoop() {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);

      const delta = this.clock.getDelta();
      if (this.mixer) {
        this.mixer.update(delta);
      }

      // Update lip sync if speaking
      if (this.isSpeaking && this.avatar) {
        this.updateLipSync();
      }

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  private updateLipSync() {
    if (!this.analyser || !this.dataArray || !this.avatar) return;

    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Calculate average volume
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const average = sum / this.dataArray.length;
    const normalizedVolume = Math.min(average / 255, 1);

    // Find mouth/jaw bones or morph targets for lip sync
    this.avatar.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        // Try to find jaw or mouth morph targets
        if (child.morphTargetDictionary) {
          const jawOpenIndex = child.morphTargetDictionary['jawOpen'] || 
                              child.morphTargetDictionary['mouthOpen'] ||
                              child.morphTargetDictionary['viseme_aa'];
          
          if (jawOpenIndex !== undefined) {
            child.morphTargetInfluences![jawOpenIndex] = normalizedVolume * 0.5;
          }
        }
      }
    });
  }

  /**
   * Start speaking with audio for lip sync
   */
  async startSpeaking(audioUrl: string) {
    try {
      this.isSpeaking = true;

      // Setup audio context for lip sync analysis
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      // Fetch and play audio
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      
      source.onended = () => {
        this.stopSpeaking();
      };

      source.start(0);
    } catch (error) {
      console.error('Error starting speech:', error);
      this.stopSpeaking();
    }
  }

  /**
   * Stop speaking
   */
  stopSpeaking() {
    this.isSpeaking = false;
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.dataArray = null;
  }

  /**
   * Speak text using TTS (integrates with existing TTS system)
   */
  async speakText(text: string, ttsCallback: (text: string) => Promise<string>): Promise<void> {
    try {
      const audioUrl = await ttsCallback(text);
      await this.startSpeaking(audioUrl);
    } catch (error) {
      console.error('Error speaking text:', error);
    }
  }

  /**
   * Dispose of resources
   */
  dispose() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    this.stopSpeaking();
    
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    if (this.avatar) {
      this.scene.remove(this.avatar);
      this.avatar.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      this.avatar = null;
    }

    this.renderer.dispose();
    window.removeEventListener('resize', this.handleResize.bind(this));
  }

  /**
   * Get Ready Player Me avatar URL from avatar ID or full URL
   */
  static getAvatarUrl(avatarIdOrUrl: string): string | null {
    // Validate input
    if (!avatarIdOrUrl || avatarIdOrUrl.trim() === '' || avatarIdOrUrl.length < 10) {
      console.warn('Invalid avatar URL/ID provided:', avatarIdOrUrl);
      return null;
    }

    // If it's already a full URL, validate and return it
    if (avatarIdOrUrl.startsWith('http')) {
      // Validate it's a Ready Player Me URL
      if (avatarIdOrUrl.includes('readyplayer.me') && avatarIdOrUrl.endsWith('.glb')) {
        return avatarIdOrUrl;
      }
      console.warn('Invalid avatar URL format:', avatarIdOrUrl);
      return null;
    }

    // If it's a Ready Player Me avatar ID, construct the URL
    // Ready Player Me avatar URLs: https://models.readyplayer.me/{avatarId}.glb
    if (avatarIdOrUrl.includes('readyplayer.me') || avatarIdOrUrl.endsWith('.glb')) {
      return avatarIdOrUrl;
    }

    // Only construct URL if it looks like a valid ID (long alphanumeric string)
    // Ready Player Me IDs are typically long (20+ chars)
    if (avatarIdOrUrl.length < 15 || !/^[a-zA-Z0-9]+$/.test(avatarIdOrUrl)) {
      console.warn('Invalid avatar ID format (too short or invalid chars):', avatarIdOrUrl);
      return null;
    }

    return `https://models.readyplayer.me/${avatarIdOrUrl}.glb`;
  }
}

/**
 * Create a Ready Player Me avatar from a URL or avatar ID
 */
export async function createReadyPlayerMeAvatar(
  avatarUrlOrId: string,
  container: HTMLDivElement,
  onLoad?: () => void,
  onError?: (error: Error) => void
): Promise<ReadyPlayerMeAvatar | null> {
  const fullUrl = ReadyPlayerMeAvatar.getAvatarUrl(avatarUrlOrId);
  
  // If URL is invalid, don't create avatar
  if (!fullUrl) {
    const error = new Error(`Invalid avatar URL/ID: ${avatarUrlOrId}`);
    onError?.(error);
    return null;
  }
  
  const avatar = new ReadyPlayerMeAvatar({
    avatarUrl: fullUrl,
    container,
    onLoad,
    onError,
  });
  return avatar;
}

