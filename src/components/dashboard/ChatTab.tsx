import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Mic, MicOff, Loader2, Bot, Play, Pause, User, Video, VideoOff, ListTodo, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { getGitHubToken, getGitHubUserFromStorage } from "@/lib/github-auth";
import { fetchRelevantGitHubFiles, formatFilesForContext, fetchGitHubFile, extractFilePaths, formatFileForReview } from "@/lib/github";
// Using FishAudio for STT + TTS and LLMService for text generation
import { FishAudioSTT, FishAudioTTS } from "@/lib/fishaudio-service";
import { LLMService } from "@/lib/llm-service";
import { MultiAgentManager, AgentResponse } from "@/lib/multi-agent-manager";
import { ReadyPlayerMeAvatar, createReadyPlayerMeAvatar } from "@/lib/ready-player-me";
import { getMVPAvatars, initializeMVPAvatars } from "@/lib/mvp-avatars";
import { getEngineers, saveEngineer, generateId, Engineer, getTasks } from "@/lib/localstorage-data";
import { AgentResponse } from "@/lib/multi-agent-manager";

type MessageRole = "user" | "engineer";

type Message = {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: Date;
  audioUrl?: string;
  videoUrl?: string;
  engineerId?: string;
};

export default function ChatTab() {
  const [input, setInput] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]); // Chat messages only
  const [callMessages, setCallMessages] = useState<Message[]>([]); // Call messages (separate from chat)
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isRequestingAccess, setIsRequestingAccess] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [isRealtimeCall, setIsRealtimeCall] = useState(false); // New: real-time vs pre-generated
  const [isUserVideoReady, setIsUserVideoReady] = useState(false); // Track if user video is ready
  const [currentEngineer, setCurrentEngineer] = useState<{ id: string; name: string; avatar_url: string | null } | null>(null);
  const [activeAgents, setActiveAgents] = useState<Array<{ id: string; name: string; specialty: string | null; avatar_url: string | null }>>([]);
  const [selectedEngineerIds, setSelectedEngineerIds] = useState<Set<string>>(new Set()); // Track selected engineers for call
  const [showEngineerSelection, setShowEngineerSelection] = useState(false); // Show engineer selection dialog
  const [speakingAgents, setSpeakingAgents] = useState<Set<string>>(new Set());
  const multiAgentManagerRef = useRef<MultiAgentManager | null>(null);
  const [analyzingFile, setAnalyzingFile] = useState<string | null>(null);
  const [githubConnection, setGithubConnection] = useState<{ username: string; repo: string; base_branch?: string } | null>(null);
  const [realtimeTranscript, setRealtimeTranscript] = useState<string>(""); // Live transcript during call
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null); // User's video stream
  const userVideoRef = useRef<HTMLVideoElement | null>(null); // User's video element
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Using FishAudio for STT + TTS
  const fishAudioSTTRef = useRef<FishAudioSTT | null>(null);
  const fishAudioTTSRef = useRef<FishAudioTTS | null>(null);
  const llmServiceRef = useRef<LLMService | null>(null);
  const avatarRefs = useRef<Map<string, ReadyPlayerMeAvatar>>(new Map());
  const avatarContainerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const isRealtimeCallRef = useRef<boolean>(false); // Ref to track realtime call state for callbacks
  const isVideoCallActiveRef = useRef<boolean>(false); // Ref to track video call state for callbacks
  const transcriptTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout to mark transcript as final after silence
  const pendingTranscriptRef = useRef<string>(""); // Store the latest transcript until it's finalized

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current = null;
      }
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = null;
      }
      // Cleanup FishAudio
      if (fishAudioSTTRef.current) {
        fishAudioSTTRef.current.stop();
        fishAudioSTTRef.current = null;
      }
      if (fishAudioTTSRef.current) {
        fishAudioTTSRef.current.stop();
        fishAudioTTSRef.current = null;
      }
      // Cleanup avatars
      avatarRefs.current.forEach(avatar => avatar.dispose());
      avatarRefs.current.clear();
      avatarContainerRefs.current.clear();
    };
  }, []);

  // Setup avatars when video call becomes active
  useEffect(() => {
    if (isVideoCallActive && isRealtimeCall) {
      // Avatars will be initialized when containers are ready
      activeAgents.forEach(agent => {
        if (agent.avatar_url && avatarContainerRefs.current.has(agent.id)) {
          const container = avatarContainerRefs.current.get(agent.id);
          if (container && !avatarRefs.current.has(agent.id)) {
            // Validate avatar URL before attempting to load
            if (!agent.avatar_url || agent.avatar_url.length < 10 || agent.avatar_url === '01' || agent.avatar_url === '01.glb') {
              console.warn(`⚠️ Invalid avatar URL for ${agent.name}: ${agent.avatar_url}. Skipping avatar load.`);
              return;
            }
            
            createReadyPlayerMeAvatar(
              agent.avatar_url,
              container,
              () => {
                console.log(`✅ Avatar loaded for ${agent.name}`);
                toast.success(`${agent.name}'s avatar loaded`, { duration: 2000 });
              },
              (error) => {
                console.error(`❌ Error loading avatar for ${agent.name}:`, error);
                toast.error(`Failed to load ${agent.name}'s avatar`, { duration: 3000 });
              }
            ).then(avatar => {
              if (avatar) {
                avatarRefs.current.set(agent.id, avatar);
              }
            }).catch(error => {
              console.error(`Failed to create avatar for ${agent.name}:`, error);
            });
          }
        }
      });
    }

    return () => {
      // Cleanup avatars when video call ends
      if (!isVideoCallActive) {
        avatarRefs.current.forEach(avatar => avatar.dispose());
        avatarRefs.current.clear();
      }
    };
  }, [isVideoCallActive, isRealtimeCall, activeAgents]);

  // Load GitHub connection and conversation history on mount
  useEffect(() => {
    const loadData = async () => {
      // Load GitHub connection from localStorage
      try {
        const saved = localStorage.getItem('github_connection');
        if (saved) {
          const connection = JSON.parse(saved);
          if (connection?.github_username && connection?.github_repo_name) {
            setGithubConnection({
              username: connection.github_username,
              repo: connection.github_repo_name,
              base_branch: connection.base_branch || 'main',
            });
          }
        }
      } catch (error) {
        console.warn('Could not load GitHub connection:', error);
      }

      // Load conversation history from localStorage
      try {
        const savedMessages = localStorage.getItem('devspace-chat-history');
        if (savedMessages) {
          const parsed = JSON.parse(savedMessages);
          // Convert timestamp strings back to Date objects
          const messagesWithDates = parsed.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
          setMessages(messagesWithDates);
        }
      } catch (error) {
        console.warn('Could not load conversation history:', error);
      }
    };
    loadData();
  }, []);

  // Save conversation history to localStorage whenever messages change (only chat, not call messages)
  useEffect(() => {
    // Only save chat messages, not call messages
    if (messages.length > 0 && !isRealtimeCall) {
      try {
        localStorage.setItem('devspace-chat-history', JSON.stringify(messages));
      } catch (error) {
        console.warn('Could not save conversation history:', error);
      }
    }
  }, [messages, isRealtimeCall]);

  // Ensure video element gets stream when it becomes available
  useEffect(() => {
    if (!isVideoCallActive) return;
    
    let isMounted = true;
    let playPromise: Promise<void> | null = null;
    
    const checkAndAttachStream = () => {
      if (!isMounted) return;
      
      if (videoStreamRef.current && userVideoRef.current) {
        const videoEl = userVideoRef.current;
        if (!videoEl.srcObject || videoEl.srcObject !== videoStreamRef.current) {
          console.log('📹 Video element ready, attaching stream via useEffect');
          videoEl.srcObject = videoStreamRef.current;
          
          // Only call play() if not already playing and no pending play promise
          if (videoEl.paused && !playPromise) {
            playPromise = videoEl.play().then(() => {
              if (isMounted) {
                console.log('✅ Video play() succeeded in useEffect');
                setIsUserVideoReady(true);
              }
              playPromise = null;
            }).catch((error) => {
              // Ignore AbortError - it's usually harmless (element was removed/cleaned up)
              if (error.name !== 'AbortError' && isMounted) {
                console.error('❌ Video play() failed in useEffect:', error);
              } else if (error.name === 'AbortError') {
                console.log('ℹ️ Video play() aborted (normal during cleanup)');
              }
              playPromise = null;
            });
          }
        }
      }
    };
    
    // Check immediately
    checkAndAttachStream();
    
    // Also check after a short delay in case refs aren't ready yet
    const timeout = setTimeout(() => {
      if (isMounted) {
        checkAndAttachStream();
      }
    }, 200);
    
    return () => {
      isMounted = false;
      clearTimeout(timeout);
      // Cancel any pending play promise
      if (playPromise && userVideoRef.current) {
        userVideoRef.current.pause();
      }
    };
  }, [isVideoCallActive]);

  const startRecording = async () => {
    console.log("startRecording called");
    
    // Prevent multiple simultaneous requests
    if (isRequestingAccess || isRecording) {
      console.log("Already requesting access or recording, ignoring");
      return;
    }

    try {
      // Check if we're on a secure context (HTTPS or localhost)
      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        throw new Error("Microphone access requires HTTPS or localhost");
      }

      // Check if MediaRecorder is supported
      if (!navigator.mediaDevices) {
        throw new Error("navigator.mediaDevices is not available. This might be an insecure context (needs HTTPS or localhost).");
      }
      
      if (!navigator.mediaDevices.getUserMedia) {
        throw new Error("getUserMedia is not available in this browser.");
      }
      
      console.log("MediaDevices API available");
      console.log("Supported constraints:", navigator.mediaDevices.getSupportedConstraints());

      // Check current permission status
      let permissionState = 'prompt';
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        permissionState = permissionStatus.state;
        console.log("Microphone permission status:", permissionState);
        if (permissionState === 'denied') {
          throw new Error("Microphone permission was previously denied. Please enable it in browser settings.");
        }
      } catch (permError) {
        // Permission query might not be supported, that's okay
        console.log("Permission query not supported, continuing...");
      }

      if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        console.warn("WebM with Opus not supported, trying default");
      }

      setIsRequestingAccess(true);
      console.log("Requesting microphone access...");
      console.log("Page focused:", document.hasFocus());
      console.log("User agent:", navigator.userAgent);
      console.log("Is secure context:", window.isSecureContext);
      console.log("Location:", window.location.href);
      
      // Detect Arc browser
      const isArcBrowser = navigator.userAgent.includes('Arc') || window.location.hostname.includes('arc');
      console.log("Is Arc browser:", isArcBrowser);
      
      // Show user a message that they need to allow the prompt
      if (permissionState === 'prompt') {
        const message = isArcBrowser 
          ? "🔊 Arc Browser: Check the address bar for a microphone icon, or go to Arc Settings → Privacy → Microphone to allow access"
          : "🔊 Look for a browser permission prompt (usually in the address bar) and click 'Allow'";
        toast.info(message, { 
          duration: 10000,
          position: 'top-center'
        });
        // Give user time to see the message
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Request microphone access - use simple audio (most compatible)
      console.log("Attempting getUserMedia with simple audio...");
      
      // For Arc, try with a longer timeout and better error handling
      const getUserMediaPromise = navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Add a timeout specifically for Arc browser (20 seconds)
      const timeoutPromise = new Promise<MediaStream>((_, reject) => 
        setTimeout(() => reject(new Error(isArcBrowser 
          ? "Arc Browser: Permission request timed out. Please check Arc Settings → Privacy → Microphone and ensure localhost:8080 is allowed."
          : "Microphone access request timed out. Please check browser permissions.")), 
        isArcBrowser ? 20000 : 15000)
      );
      
      const stream = await Promise.race([getUserMediaPromise, timeoutPromise]);
      console.log("Microphone access granted, stream:", stream);
      console.log("Stream active:", stream.active);
      console.log("Audio tracks:", stream.getAudioTracks().length);
      setIsRequestingAccess(false);
      streamRef.current = stream;

      // Try to use WebM, fallback to default if not supported
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = ''; // Use browser default
        }
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log("Data available, size:", event.data.size);
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log("Recording stopped, chunks:", audioChunksRef.current.length);
        await handleRecordingStop();
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        toast.error("Recording error occurred");
        setIsRecording(false);
      };

      console.log("Starting MediaRecorder with mimeType:", mimeType || "default");
      mediaRecorder.start();
      setIsRecording(true);
      toast.success("Recording started");
    } catch (error) {
      console.error("Error accessing microphone:", error);
      setIsRequestingAccess(false);
      setIsRecording(false);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (errorMessage.includes("permission") || errorMessage.includes("Permission") || errorMessage.includes("denied")) {
        toast.error("Microphone permission denied. Please allow microphone access in your browser settings and refresh the page.");
      } else if (errorMessage.includes("not found") || errorMessage.includes("NotFound") || errorMessage.includes("No CoreAudioCaptureSource") || errorMessage.includes("No device")) {
        toast.error("No microphone found. Please connect a microphone or check System Preferences > Sound > Input on macOS.");
      } else if (errorMessage.includes("timed out")) {
        toast.error("Microphone access request timed out. Please check your browser permissions and try again.");
      } else {
        toast.error(`Failed to access microphone: ${errorMessage}. Please check your microphone connection and browser permissions.`);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  };

  const handleRecordingStop = async () => {
    console.log("🎤 [VOICE CHAT] Recording stopped, chunks:", audioChunksRef.current.length);
    if (audioChunksRef.current.length === 0) {
      console.error("❌ [VOICE CHAT] No audio chunks recorded");
      toast.error("No audio recorded");
      return;
    }

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
    console.log("🎤 [VOICE CHAT] Audio blob created, size:", audioBlob.size);
    await uploadAudio(audioBlob);
  };

  const uploadAudio = async (audioBlob: Blob) => {
    console.log("🎤 [VOICE CHAT] Step 1: uploadAudio called - using FishAudio STT");
    setIsUploading(true);
    setTranscript("");

    // Use FishAudio STT for transcription
    const fishAudioApiKey = import.meta.env.VITE_FISHAUDIO_API_KEY;
    if (!fishAudioApiKey) {
      toast.error("FishAudio API key is required. Please check your .env file.");
      setIsUploading(false);
      return;
    }
    
    try {
      console.log("🎤 [VOICE CHAT] Step 2: Using FishAudio STT for transcription");
      
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
        headers['X-FishAudio-API-Key'] = fishAudioApiKey;
      } else {
        headers['Authorization'] = `Bearer ${fishAudioApiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`FishAudio STT error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const transcriptText = data.text || data.transcript || '';
      
      console.log("✅ [VOICE CHAT] FishAudio transcript received:", transcriptText);
      
      if (transcriptText && transcriptText.trim().length > 0) {
        const trimmedTranscript = transcriptText.trim();
        setTranscript(trimmedTranscript);
        
        // Add user message
        const userMessage: Message = {
          id: `user-${Date.now()}`,
          role: "user",
          text: trimmedTranscript,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        
        toast.success("Transcript received");
        
        // Send to LLM
        console.log("🚀 [VOICE CHAT] Sending transcript to LLM:", trimmedTranscript);
        await sendToLLM(trimmedTranscript, false);
      } else {
        toast.error("No transcript received from FishAudio");
      }
    } catch (error) {
      console.error("Error processing audio with FishAudio:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to process audio: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isUploading || isGeneratingResponse) return;
    
    const messageText = input.trim();
    setInput("");
    
    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      text: messageText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    
    // Send to LLM Service (Supabase Edge Functions)
    await sendToLLM(messageText, false);
  };

  const sendToLLM = async (transcriptText: string, isRealtime = false) => {
    console.log("🤖 [LLM] Step 1: sendToLLM called with transcript:", {
      transcriptText,
      length: transcriptText?.length || 0,
      isEmpty: !transcriptText || transcriptText.trim().length === 0,
      isRealtime
    });

    // Validate transcript is not empty
    if (!transcriptText || transcriptText.trim().length === 0) {
      console.error("❌ [LLM] Empty transcript provided to sendToLLM!");
      toast.error("Cannot send empty message to AI");
      return;
    }

    setIsGeneratingResponse(true);

    // Initialize LLM Service if not already done
    if (!llmServiceRef.current) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !supabaseKey) {
        toast.error("Supabase configuration missing. Please check your .env file.");
        setIsGeneratingResponse(false);
        return;
      }
      llmServiceRef.current = new LLMService({
        supabaseUrl,
        supabaseKey,
        functionName: import.meta.env.VITE_SUPABASE_LLM_FUNCTION || 'generate-text',
        model: import.meta.env.VITE_LLM_MODEL || 'meta-llama/llama-3-8b-instruct',
        temperature: parseFloat(import.meta.env.VITE_LLM_TEMPERATURE || '0.7'),
        maxTokens: parseInt(import.meta.env.VITE_LLM_MAX_TOKENS || '2048'),
      });
    }

    try {
      // Fetch GitHub repository context if configured
      let repoContext = '';
      // System prompt should NOT include generic greetings - it should be professional and direct
      // IMPORTANT: Respond to the ACTUAL user message content, not with generic greetings
      let systemPrompt = 'You are a senior software engineer AI assistant. Your role is to help users with technical questions and code-related tasks. IMPORTANT: Always respond directly to what the user said. If the user asks a question, answer it. If they make a request, fulfill it. Do NOT use generic greetings like "Hi, how can I help you?" unless the user explicitly greets you first. Be direct, helpful, and technical.';
      
      try {
        // Load GitHub connection from localStorage
        const saved = localStorage.getItem('github_connection');
        const token = getGitHubToken();
        let connection: { github_username?: string; github_repo_name?: string; github_token?: string; base_branch?: string } | null = null;
        
        if (saved) {
          try {
            connection = JSON.parse(saved);
            // Add token from auth
            if (token) {
              connection = { ...connection, github_token: token };
            }
          } catch {
            // Ignore parse errors
          }
        }

        if (connection?.github_username && connection?.github_repo_name) {
          // Check if user is asking for a code review of a specific file
          const filePaths = extractFilePaths(transcriptText);
          const isCodeReview = /review|analyze|check|examine|look at/i.test(transcriptText);
          
          if (filePaths.length > 0 && isCodeReview) {
            // Fetch specific files for code review
            toast.info(`Analyzing ${filePaths.length} file(s)...`);
            for (const filePath of filePaths.slice(0, 3)) { // Limit to 3 files
              try {
                setAnalyzingFile(filePath);
                const content = await fetchGitHubFile(
                  connection.github_username,
                  connection.github_repo_name,
                  filePath,
                  connection.github_token
                );
                repoContext += formatFileForReview(filePath, content);
                toast.success(`Fetched ${filePath}`);
              } catch (error) {
                console.error(`Error fetching ${filePath}:`, error);
                toast.error(`Could not fetch ${filePath}`);
              }
            }
            setAnalyzingFile(null);
            systemPrompt = 'You are a senior software engineer conducting a code review. Analyze the provided code for bugs, security issues, performance problems, and best practices. Provide specific suggestions with line numbers. Format your response with clear sections for each issue type, and include code examples showing before/after when applicable.';
          } else {
            // Fetch general repository context
            console.log(`Fetching GitHub context from ${connection.github_username}/${connection.github_repo_name}`);
            const files = await fetchRelevantGitHubFiles(
              connection.github_username,
              connection.github_repo_name,
              connection.github_token
            );
            
            if (files.length > 0) {
              repoContext = formatFilesForContext(files);
              console.log(`Included ${files.length} files from repository`);
            }
          }
        }
      } catch (githubError) {
        console.warn('Error fetching GitHub context:', githubError);
        // Don't block the request if GitHub fetch fails
      }

      // Combine user question with repository context
      const userContent = transcriptText.trim() + (repoContext ? '\n\n' + repoContext : '');
      
      console.log("🤖 [LLM] Step 2: Preparing LLM request:", {
        transcriptText: transcriptText.trim(),
        transcriptLength: transcriptText.trim().length,
        hasRepoContext: repoContext.length > 0,
        userContentLength: userContent.length,
        systemPrompt: systemPrompt.substring(0, 100) + '...'
      });

      const requestBody = {
        contents: [{
          role: 'user',
          parts: [{ text: userContent }],
        }],
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      };

      console.log("🤖 [LLM] Step 3: Sending request to LLM Service:", {
        userMessagePreview: userContent.substring(0, 100) + '...',
        userMessageLength: userContent.length
      });

      // Use LLMService to generate response
      const engineerResponse = await llmServiceRef.current.generate(
        [{ role: 'user', content: userContent }],
        systemPrompt,
        {
          temperature: 0.7,
          maxTokens: 8192,
        }
      );
      
      console.log("🤖 [LLM] Step 4: Received LLM response:", {
        responseLength: engineerResponse.length,
        responsePreview: engineerResponse.substring(0, 100) + '...',
        isGenericGreeting: /^(hi|hello|hey|how can i help|how may i help)/i.test(engineerResponse.trim()),
        fullResponse: engineerResponse
      });

      // Get the first engineer (or selected engineer) for avatar
      let engineerAvatarId: string | null = null;
      let engineerId: string | null = null;
      let engineerSpecialty: string | null = null;
      try {
        const engineersList = getEngineers();
        let engineers = engineersList.length > 0 ? engineersList[0] : null;
        
        // If no engineer exists, create a default one
        if (!engineers) {
          // Default Ready Player Me avatar URL (Avatar 1)
          const defaultAvatarUrl = import.meta.env.VITE_AVATAR_1_URL || import.meta.env.VITE_DEFAULT_AVATAR_URL || 'https://models.readyplayer.me/69226336672cca15c2b4bb34.glb';
          const newEngineer: Engineer = {
            id: generateId(),
            name: 'AI Engineer',
            avatar_url: defaultAvatarUrl,
            specialty: 'general',
            fish_voice_id: null,
            fish_voice_id: import.meta.env.VITE_FISHAUDIO_DEFAULT_VOICE_ID || null,
            personality: null,
            created_at: new Date().toISOString(),
          };
          saveEngineer(newEngineer);
          engineers = newEngineer;
        }
        
        if (engineers) {
          // Use environment variable avatar URL as fallback
          engineerAvatarId = engineers.avatar_url || import.meta.env.VITE_AVATAR_1_URL || import.meta.env.VITE_DEFAULT_AVATAR_URL || 'https://models.readyplayer.me/69226336672cca15c2b4bb34.glb';
          engineerId = engineers.id;
          engineerSpecialty = engineers.specialty;
          if (!currentEngineer) {
            setCurrentEngineer({
              id: engineers.id,
              name: engineers.name,
              avatar_url: engineerAvatarId,
            });
          }
        }
      } catch (error) {
        console.warn('Could not fetch engineer for avatar:', error);
      }

      // Enhance system prompt with engineer specialty
      if (engineerSpecialty && engineerSpecialty !== 'general') {
        const specialtyPrompts: Record<string, string> = {
          backend: 'You are a senior backend engineer specializing in server-side development, APIs, databases, and system architecture.',
          frontend: 'You are a senior frontend engineer specializing in user interfaces, React, TypeScript, and modern web technologies.',
          fullstack: 'You are a senior full-stack engineer with expertise in both frontend and backend development.',
          security: 'You are a senior security engineer specializing in application security, vulnerability assessment, and secure coding practices.',
          devops: 'You are a senior DevOps engineer specializing in infrastructure, CI/CD, containerization, and cloud platforms.',
          mobile: 'You are a senior mobile engineer specializing in iOS, Android, and cross-platform mobile development.',
          'ai/ml': 'You are a senior AI/ML engineer specializing in machine learning, neural networks, and AI system development.',
        };
        if (specialtyPrompts[engineerSpecialty]) {
          systemPrompt = specialtyPrompts[engineerSpecialty] + ' ' + systemPrompt;
        }
      }

      // Add engineer message
      console.log("🤖 [LLM] Step 5: Adding engineer response to messages");
      const engineerMessage: Message = {
        id: `engineer-${Date.now()}`,
        role: 'engineer',
        text: engineerResponse,
        timestamp: new Date(),
        engineerId: engineerId || undefined,
      };
      setMessages(prev => [...prev, engineerMessage]);

      // TTS is now handled by FishAudio via multi-agent manager
      // Avatars will sync automatically with audio from FishAudio
      if (isVideoCallActive && engineerId && avatarRefs.current.has(engineerId)) {
        const avatar = avatarRefs.current.get(engineerId);
        // Avatar will sync with audio automatically via audio analysis
      }
      
      // Legacy fallback (removed - using FishAudio now)
      if (false) {
        console.log("🔊 [TTS] Step 6: Generating TTS audio for voice chat response");
        // Generate TTS audio (with optional voice ID from engineer if available)
        await generateTTS(engineerResponse, engineerMessage.id, null);
        
        // If in video call mode, make avatar speak
        if (isVideoCallActive && engineerId && engineerAvatarId && avatarRefs.current.has(engineerId)) {
          const avatar = avatarRefs.current.get(engineerId);
          const audioUrl = messages.find(m => m.id === engineerMessage.id)?.audioUrl;
          if (avatar && audioUrl) {
            avatar.startSpeaking(audioUrl).catch(console.error);
          }
        }
      }
      
      console.log("✅ [VOICE CHAT] Complete: Response displayed and TTS generated");
    } catch (error) {
      console.error('Error calling LLM service:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get engineer response');
    } finally {
      setIsGeneratingResponse(false);
    }
  };

  const generateTTS = async (text: string, messageId: string, voiceId?: string | null) => {
      // TTS is now handled by FishAudio via multi-agent manager
      // This function is kept for backward compatibility but does nothing
      // Audio playback happens automatically through FishAudio
      console.log('TTS request (handled by FishAudio):', { text: text.substring(0, 50), messageId });
  };


  const handlePlayAudio = (audioUrl: string, messageId: string) => {
    if (playingAudioId === messageId && audioRef.current) {
      // Pause if playing
      audioRef.current.pause();
      setPlayingAudioId(null);
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Play new audio
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    setPlayingAudioId(messageId);

    audio.onended = () => {
      setPlayingAudioId(null);
      audioRef.current = null;
    };

    audio.onerror = () => {
      toast.error('Failed to play audio');
      setPlayingAudioId(null);
      audioRef.current = null;
    };

    audio.play().catch(error => {
      console.error('Error playing audio:', error);
      toast.error('Failed to play audio');
      setPlayingAudioId(null);
      audioRef.current = null;
    });
  };

  const handleMicClick = async (e?: React.MouseEvent) => {
    // Ensure we have a user gesture
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log("Microphone button clicked, isRecording:", isRecording);
    console.log("Page visibility:", document.visibilityState);
    console.log("Page focused:", document.hasFocus());
    
    if (isRecording) {
      stopRecording();
    } else {
      // Ensure page is focused before requesting media
      if (!document.hasFocus()) {
        toast.error("Please click on the page first, then try again");
        return;
      }
      await startRecording();
    }
  };

  const handleStartVideoCall = async () => {
    // Check if engineers exist
    const engineers = getEngineers();
    if (engineers.length === 0) {
      toast.error('Please add at least one engineer first');
      return;
    }
    
    // If no engineers are selected, show selection dialog
    if (selectedEngineerIds.size === 0) {
      setShowEngineerSelection(true);
      return;
    }
    
    // Verify selected engineers still exist
    const validSelectedIds = engineers.filter(e => selectedEngineerIds.has(e.id)).map(e => e.id);
    if (validSelectedIds.length === 0) {
      toast.error('Selected engineers no longer exist. Please select again.');
      setSelectedEngineerIds(new Set());
      setShowEngineerSelection(true);
      return;
      }

    // Update selected IDs to only valid ones
    if (validSelectedIds.length !== selectedEngineerIds.size) {
      setSelectedEngineerIds(new Set(validSelectedIds));
    }
    
    // Proceed with call
    await startCallWithSelectedEngineers();
  };

  const startCallWithSelectedEngineers = async () => {
    try {
      // Start real-time video call
      await startRealtimeVideoCall();
    } catch (error) {
      console.error('Error starting video call:', error);
      toast.error("Failed to start video call");
    }
  };

  const startRealtimeVideoCall = async () => {
    try {
      // Set realtime call mode FIRST, before any async operations
      setIsRealtimeCall(true);
      isRealtimeCallRef.current = true; // Update ref immediately
      setIsVideoCallActive(true);
      isVideoCallActiveRef.current = true; // Update ref immediately
      
      // Request camera and microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      videoStreamRef.current = stream;

      // Set user's video with error handling
      // Use a small delay to ensure the video element is mounted
      setTimeout(() => {
        if (userVideoRef.current) {
          console.log('📹 Setting user video stream:', { 
            hasStream: !!stream, 
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            videoElementReady: !!userVideoRef.current
          });
          
          const videoElement = userVideoRef.current;
          videoElement.srcObject = stream;
          
          // Track when video is ready
          const handleLoadedMetadata = () => {
            console.log('✅ User video metadata loaded');
            setIsUserVideoReady(true);
            videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
          };
          
          const handlePlay = () => {
            console.log('▶️ User video started playing');
            setIsUserVideoReady(true);
            videoElement.removeEventListener('play', handlePlay);
          };
          
          const handleError = (error: Event) => {
            console.error('❌ User video error:', error);
            setIsUserVideoReady(false);
          };
          
          videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
          videoElement.addEventListener('play', handlePlay);
          videoElement.addEventListener('error', handleError);
          
          // Force play immediately (only if not already playing)
          if (videoElement.paused) {
            videoElement.play().then(() => {
              console.log('✅ User video play() succeeded');
              setIsUserVideoReady(true);
            }).catch((error) => {
              // Ignore AbortError - it's usually harmless
              if (error.name === 'AbortError') {
                console.log('ℹ️ Video play() aborted (normal during cleanup)');
              } else {
                console.error('❌ Error playing user video:', error);
                // Don't show error toast immediately - might just need time
                console.log('⏳ Video might need more time to load...');
              }
            });
          } else {
            console.log('✅ User video already playing');
            setIsUserVideoReady(true);
          }
          
          // Also set ready state after a short delay as fallback
          setTimeout(() => {
            if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA
              console.log('✅ User video readyState check passed');
              setIsUserVideoReady(true);
            }
          }, 500);
        } else {
          // Video ref not ready yet - this is normal during initialization
          // Will be handled by the useEffect that watches isVideoCallActive
          // Retry after a short delay
          setTimeout(() => {
            if (userVideoRef.current && stream) {
              userVideoRef.current.srcObject = stream;
              userVideoRef.current.play().catch(console.error);
              setIsUserVideoReady(true);
            }
          }, 100);
        }
      }, 100);

      // Initialize MVP avatars FIRST to ensure voices are set correctly
      initializeMVPAvatars();

      // Load engineers (MVP: limit to 4)
      let engineers = getEngineers()
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(0, 4); // MVP: Max 4 avatars

      // Get GitHub connection for operations
      const saved = localStorage.getItem('github_connection');
      const token = getGitHubToken();
      let githubConn: { github_username?: string; github_repo_name?: string; github_token?: string; base_branch?: string } | null = null;
      
      if (saved) {
        try {
          githubConn = JSON.parse(saved);
          if (token) {
            githubConn = { ...githubConn, github_token: token };
          }
        } catch {
          // Ignore parse errors
        }
      }

      // Initialize multi-agent manager with GitHub config, FishAudio TTS, and LLM Service
      // Use refs in callbacks to avoid stale closure issues
      multiAgentManagerRef.current = new MultiAgentManager(
        (response: AgentResponse) => {
          // Handle agent response - add to CALL messages if in call, otherwise chat
          // Use ref to check current state (not stale closure)
          const isInRealtimeCall = isRealtimeCallRef.current;
          
          console.log('📨 Agent response received:', {
            agentName: response.agentName,
            textLength: response.text.length,
            isInRealtimeCall,
            timestamp: response.timestamp
          });
          
          const engineerMessage: Message = {
            id: `engineer-${response.agentId}-${Date.now()}`,
            role: 'engineer',
            text: response.text,
            timestamp: response.timestamp,
            engineerId: response.agentId,
          };
          
          // Add to call messages if in a call, otherwise chat messages
          if (isInRealtimeCall) {
            console.log('✅ Adding response to callMessages (during call)');
            setCallMessages(prev => [...prev, engineerMessage]);
          } else {
            console.log('✅ Adding response to chat messages (after call)');
            setMessages(prev => [...prev, engineerMessage]);
          }

          // Announce GitHub changes during video call
          if (response.githubChanges && isInRealtimeCall) {
            const announcement = `🔧 ${response.agentName} just pushed changes to branch ${response.githubChanges.branch}. Files: ${response.githubChanges.filesChanged.join(', ')}. View: ${response.githubChanges.commitUrl}`;
            toast.success(announcement, { duration: 8000 });
            
            // Also add as a system message to call messages
            const systemMessage: Message = {
              id: `github-${response.agentId}-${Date.now()}`,
              role: 'engineer',
              text: `🔧 **GitHub Update**: ${response.agentName} committed changes to \`${response.githubChanges.branch}\`\n\n**Files changed**: ${response.githubChanges.filesChanged.map(f => `\`${f}\``).join(', ')}\n\n**View commit**: [${response.githubChanges.commitUrl}](${response.githubChanges.commitUrl})`,
              timestamp: new Date(),
              engineerId: response.agentId,
            };
            setCallMessages(prev => [...prev, systemMessage]);
          }
        },
        (interruptedId: string, interruptingId: string) => {
          // Handle interruption
          const interrupted = engineers?.find(e => e.id === interruptedId);
          const interrupting = engineers?.find(e => e.id === interruptingId);
          if (interrupted && interrupting) {
            toast.info(`${interrupting.name} interrupted ${interrupted.name}`);
          }
          // Update speaking agents
          setSpeakingAgents(prev => {
            const newSet = new Set(prev);
            newSet.delete(interruptedId);
            newSet.add(interruptingId);
            return newSet;
          });
        },
        // GitHub config for operations
        githubConn?.github_username && githubConn?.github_repo_name && githubConn?.github_token
          ? {
              username: githubConn.github_username,
              repoName: githubConn.github_repo_name,
              token: githubConn.github_token,
              baseBranch: githubConn.base_branch || 'main',
            }
          : undefined,
        undefined, // fishAudioTTS - will be set after initialization
        undefined, // llmService - will be set after initialization
        (agentId: string, taskId: string) => {
          // Agent left to work on a task - remove from active agents
          console.log(`👋 Agent ${agentId} left call to work on task ${taskId}`);
          setActiveAgents(prev => prev.filter(a => a.id !== agentId));
        },
        'Roy' // userName
      );

      // Add selected engineers to the manager (support multiple agents)
      const allEngineers = getEngineers();
      const engineersToAdd = selectedEngineerIds.size > 0
        ? allEngineers.filter(e => selectedEngineerIds.has(e.id))
        : allEngineers; // If none selected, add all (for backward compatibility)
      
      if (engineersToAdd.length > 0) {
        console.log(`👥 [MultiAgent] Adding ${engineersToAdd.length} engineer(s) to manager`);
        const agentsToAdd: Array<{ id: string; name: string; specialty: string | null; avatar_url: string | null }> = [];
        
        for (const engineer of engineersToAdd) {
          // Check if agent can rejoin (has completed their task)
          // Note: canAgentRejoin returns true for new agents, false only if they have an active (non-completed) task
          const canRejoin = multiAgentManagerRef.current?.canAgentRejoin(engineer.id) ?? true;
          
          if (!canRejoin) {
            console.log(`⏸️ [MultiAgent] ${engineer.name} has an active task, skipping rejoin`);
            toast.info(`${engineer.name} has an active task and cannot rejoin until it's completed`);
            continue;
          }
          
          console.log(`✅ [MultiAgent] ${engineer.name} can join the call`);
          
          // Check if agent has a completed task to announce
          // Find the most recent completed task for this engineer
          const tasks = getTasks();
          const engineerTasks = tasks.filter(t => t.engineer_id === engineer.id);
          const completedTasks = engineerTasks.filter(t => t.status === 'completed');
          const runningTasks = engineerTasks.filter(t => t.status === 'running');
          
          // Only announce if there's a completed task and no newer running tasks
          let completedTask = null;
          if (completedTasks.length > 0) {
            const latestCompleted = completedTasks.sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];
            
            // Check if there's a running task created after this completed task
            const hasNewerRunningTask = runningTasks.some(t => 
              new Date(t.created_at).getTime() > new Date(latestCompleted.created_at).getTime()
            );
            
            if (!hasNewerRunningTask) {
              completedTask = latestCompleted;
            }
          }
          
          console.log(`➕ [MultiAgent] Adding agent: ${engineer.name} (ID: ${engineer.id}, voice ID: ${engineer.fish_voice_id})`);
          multiAgentManagerRef.current?.addAgent({
            id: engineer.id,
            name: engineer.name,
            specialty: engineer.specialty,
            avatar_url: engineer.avatar_url,
            fish_voice_id: engineer.fish_voice_id,
            personality: engineer.personality,
          });
          agentsToAdd.push({
              id: engineer.id,
              name: engineer.name,
              specialty: engineer.specialty,
              avatar_url: engineer.avatar_url,
          });
          
          // If agent has a completed task, announce it
          if (completedTask && multiAgentManagerRef.current) {
            const completionMessage = `Roy, I have finished the task "${completedTask.description.substring(0, 100)}${completedTask.description.length > 100 ? '...' : ''}".`;
            setTimeout(() => {
              const completionResponse: AgentResponse = {
                agentId: engineer.id,
                agentName: engineer.name,
                text: completionMessage,
                timestamp: new Date(),
              };
              setCallMessages(prev => [...prev, {
                id: `call-completion-${engineer.id}-${Date.now()}`,
                role: "engineer",
                text: completionMessage,
                timestamp: new Date(),
                engineerId: engineer.id,
              }]);
              // Speak the completion message
              // Use FishAudio TTS for completion message
              if (fishAudioTTSRef.current && engineer.fish_voice_id) {
                const engineerTTS = new FishAudioTTS({
                  apiKey: import.meta.env.VITE_FISHAUDIO_API_KEY || '',
                  voiceId: engineer.fish_voice_id,
                });
                engineerTTS.speak(completionMessage).catch(console.error);
              }
            }, 1000); // Wait 1 second after joining
          }
        }
        
          console.log(`✅ [MultiAgent] Total agents in manager: ${multiAgentManagerRef.current?.getAllAgents().length || 0}`);
        console.log(`✅ [MultiAgent] Setting activeAgents:`, agentsToAdd.map(a => ({ id: a.id, name: a.name })));
        setActiveAgents(agentsToAdd);
        
        // Verify agents were added correctly
        if (agentsToAdd.length === 0) {
          console.error('❌ [MultiAgent] No agents were added to activeAgents!');
          toast.error('Failed to add agents to call. Please try again.');
          return;
        }
      } else {
        console.warn('⚠️ No engineers selected or available. Please add engineers first.');
        toast.error('Please add at least one engineer before starting a call');
        setIsVideoCallActive(false);
        setIsRealtimeCall(false);
        return;
      }

      // Initialize FishAudio STT for real-time voice transcription
      const fishAudioApiKey = import.meta.env.VITE_FISHAUDIO_API_KEY;
      if (!fishAudioApiKey) {
        toast.error('FishAudio API key is required. Please check your .env file.');
        setIsVideoCallActive(false);
        setIsRealtimeCall(false);
        return;
      }

      // Initialize FishAudio STT
      fishAudioSTTRef.current = new FishAudioSTT({
        apiKey: fishAudioApiKey,
        onTranscript: (text, isFinal) => {
          console.log('📝 [STT] FishAudio Transcript callback:', { text, isFinal, textLength: text.length });
          
          // If user starts speaking (partial transcript), interrupt all AI audio
          if (!isFinal && text.trim().length > 0) {
            console.log('📝 [STT] Partial transcript - user is speaking, interrupting AI');
            // User is speaking - stop all AI audio immediately
            if (multiAgentManagerRef.current) {
              multiAgentManagerRef.current.interruptAllSpeaking();
            }
            if (fishAudioTTSRef.current) {
              fishAudioTTSRef.current.stop();
            }
          }
          
          if (isFinal) {
            // Final transcript - user finished speaking
            console.log('📝 [STT] Final transcript received:', text);
            setRealtimeTranscript("");
            
            // Mark user as finished speaking (allows TTS to proceed)
            if (multiAgentManagerRef.current) {
              multiAgentManagerRef.current.setUserSpeaking(false);
            }
            
            // Filter out very short or meaningless transcripts
            const trimmedText = text.trim();
            console.log('📝 [STT] Checking final transcript:', {
              trimmedText,
              length: trimmedText.length,
              isValid: trimmedText && trimmedText.length > 2 && !/^[.,!?;:\s]+$/.test(trimmedText)
            });
            if (trimmedText && trimmedText.length > 2 && !/^[.,!?;:\s]+$/.test(trimmedText)) {
              console.log('✅ [STT] Sending final transcript to agents:', trimmedText);
              console.log('✅ [STT] Calling handleRealtimeMessage with:', trimmedText);
              handleRealtimeMessage(trimmedText);
            } else {
              console.warn('⚠️ [STT] Final transcript too short or meaningless, skipping:', trimmedText);
            }
            // Clear pending transcript
            pendingTranscriptRef.current = "";
            if (transcriptTimeoutRef.current) {
              clearTimeout(transcriptTimeoutRef.current);
              transcriptTimeoutRef.current = null;
            }
          } else {
            // Partial transcript - user is still speaking
            console.log('📝 [STT] Partial transcript - showing live:', text);
            setRealtimeTranscript(text);
            pendingTranscriptRef.current = text;
            
            // Clear existing timeout
            if (transcriptTimeoutRef.current) {
              clearTimeout(transcriptTimeoutRef.current);
            }
            
            // Set timeout to mark transcript as final after 1 second of silence (increased to avoid cutting off speech)
            transcriptTimeoutRef.current = setTimeout(() => {
              const finalText = pendingTranscriptRef.current.trim();
              // Filter out very short or meaningless transcripts
              console.log('⏰ [STT] Transcript timeout - checking final text:', {
                finalText,
                length: finalText.length,
                isValid: finalText && finalText.length > 2 && !/^[.,!?;:\s]+$/.test(finalText)
              });
              if (finalText && finalText.length > 2 && !/^[.,!?;:\s]+$/.test(finalText)) {
                console.log('⏰ [STT] Transcript timeout - marking as final:', finalText);
                setRealtimeTranscript("");
                
                // Mark user as finished speaking (allows TTS to proceed)
                if (multiAgentManagerRef.current) {
                  multiAgentManagerRef.current.setUserSpeaking(false);
                }
                
                console.log('⏰ [STT] Calling handleRealtimeMessage with timeout text:', finalText);
                handleRealtimeMessage(finalText);
                pendingTranscriptRef.current = "";
              } else {
                console.warn('⚠️ [STT] Transcript timeout - text too short or meaningless, skipping:', finalText);
              }
              transcriptTimeoutRef.current = null;
            }, 1000); // 1 second of silence = final (increased to avoid cutting off user mid-sentence)
          }
        },
      });

      // Start FishAudio STT recording
      await fishAudioSTTRef.current.start();
      
      // Initialize FishAudio TTS and LLM Service for multi-agent manager
      if (multiAgentManagerRef.current) {
        // Initialize FishAudio TTS
        if (!fishAudioTTSRef.current) {
          fishAudioTTSRef.current = new FishAudioTTS({
            apiKey: fishAudioApiKey,
            voiceId: import.meta.env.VITE_FISHAUDIO_DEFAULT_VOICE_ID,
          });
        }
        
        // Initialize LLM Service
        if (!llmServiceRef.current) {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          if (supabaseUrl && supabaseKey) {
            llmServiceRef.current = new LLMService({
              supabaseUrl,
              supabaseKey,
              functionName: import.meta.env.VITE_SUPABASE_LLM_FUNCTION || 'generate-text',
              model: import.meta.env.VITE_LLM_MODEL || 'meta-llama/llama-3-8b-instruct',
              temperature: parseFloat(import.meta.env.VITE_LLM_TEMPERATURE || '0.7'),
              maxTokens: parseInt(import.meta.env.VITE_LLM_MAX_TOKENS || '2048'),
            });
          }
        }
        
        // Set FishAudio TTS and LLM Service in multi-agent manager
        if (fishAudioTTSRef.current) {
          multiAgentManagerRef.current.setFishAudioTTS(fishAudioTTSRef.current);
        }
        if (llmServiceRef.current) {
          multiAgentManagerRef.current.setLLMService(llmServiceRef.current);
        }
        console.log('✅ Multi-agent manager configured with FishAudio TTS and LLM Service');
      }

      // isRealtimeCall and isVideoCallActive are already set above
      toast.success(`Real-time video call started with ${activeAgents.length || 1} engineer(s)`);
      
      // Test message removed - user will speak naturally
    } catch (error) {
      console.error('Error starting real-time video call:', error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (errorMessage.includes("permission") || errorMessage.includes("denied")) {
        toast.error("Camera/microphone permission denied. Please allow access and try again.");
      } else {
        toast.error(`Failed to start video call: ${errorMessage}`);
      }
    }
  };

  const handleRealtimeMessage = async (text: string) => {
    console.log('💬 handleRealtimeMessage called:', { 
      text, 
      isRealtimeCall: isRealtimeCallRef.current, 
      isRealtimeCallState: isRealtimeCall,
      hasMultiAgent: !!multiAgentManagerRef.current,
      isVideoCallActive 
    });
    
    // Add user message to CALL messages (not chat)
    const userMessage: Message = {
      id: `call-user-${Date.now()}`,
      role: "user",
      text: text,
      timestamp: new Date(),
    };
    setCallMessages(prev => [...prev, userMessage]);

    // ALWAYS use multi-agent manager if available (it's initialized during video call setup)
    // This ensures immediate responses during video calls
    if (multiAgentManagerRef.current) {
      console.log('🤖 [MultiAgent] Using multi-agent manager for response');
      
      // Get GitHub context if available
      const saved = localStorage.getItem('github_connection');
      const token = getGitHubToken();
      let connection: { github_username?: string; github_repo_name?: string; github_token?: string; base_branch?: string } | null = null;
      
      if (saved) {
        try {
          connection = JSON.parse(saved);
          if (token) {
            connection = { ...connection, github_token: token };
          }
        } catch {
          // Ignore parse errors
        }
      }

      // Get actual agent names for context
      const agentNames = multiAgentManagerRef.current?.getAllAgents().map(a => a.name) || [];
      
      const context = {
        ...(connection?.github_username && connection?.github_repo_name
          ? { githubRepo: `${connection.github_username}/${connection.github_repo_name}` }
          : {}),
        agentNames: agentNames,
        userName: 'Roy', // User's name
      };

      // Process with all agents (queue system ensures they wait for each other)
      console.log('🚀 [MultiAgent] Calling processUserMessage with context:', context);
      setIsGeneratingResponse(true);
      try {
        // Store ref in local variable to avoid null check issues
        const manager = multiAgentManagerRef.current;
        if (!manager) {
          throw new Error('Multi-agent manager is null');
        }
        
        // Don't await - let it process in background so UI doesn't block
        // The queue system will handle processing sequentially
        manager.processUserMessage(text, context).then(() => {
          console.log('✅ [MultiAgent] processUserMessage completed');
          
          // Update speaking agents
          const speaking = multiAgentManagerRef.current?.getSpeakingAgents() || [];
          console.log('🗣️ [MultiAgent] Speaking agents:', speaking.map(a => a.name));
          setSpeakingAgents(new Set(speaking.map(a => a.id)));
          setIsGeneratingResponse(false);
        }).catch((error) => {
          console.error('❌ [MultiAgent] Error in multi-agent processing:', error);
          toast.error(`Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setIsGeneratingResponse(false);
        });
        // Return immediately - don't wait for processing
        return;
      } catch (error) {
        console.error('❌ [MultiAgent] Error starting multi-agent processing:', error);
        setIsGeneratingResponse(false);
        // Fall through to fallback
      }
    }

    // Fallback to single-agent mode if multi-agent not available
    console.log('ℹ️ Multi-agent manager not available, using single-agent fallback');
    await sendToLLM(text, true);

    console.log('🤖 Processing with multi-agent manager...');
    setIsGeneratingResponse(true);
    try {
      // Get GitHub context if available
      const saved = localStorage.getItem('github_connection');
      const token = getGitHubToken();
      let connection: { github_username?: string; github_repo_name?: string; github_token?: string; base_branch?: string } | null = null;
      
      if (saved) {
        try {
          connection = JSON.parse(saved);
          if (token) {
            connection = { ...connection, github_token: token };
          }
        } catch {
          // Ignore parse errors
        }
      }

      const context = connection?.github_username && connection?.github_repo_name
        ? { 
            githubRepo: `${connection.github_username}/${connection.github_repo_name}`,
            // Engineers can now make changes, so include full context
          }
        : undefined;

      // Process with all agents in parallel (they can now push changes!)
      console.log('🚀 Calling processUserMessage with context:', context);
      console.log('🚀 Multi-agent manager state:', {
        hasManager: !!multiAgentManagerRef.current,
        agentCount: multiAgentManagerRef.current?.getAllAgents().length || 0,
        activeAgentCount: multiAgentManagerRef.current?.getActiveAgents().length || 0
      });
      
      await multiAgentManagerRef.current.processUserMessage(text, context);
      console.log('✅ processUserMessage completed');
      
      // Update speaking agents
      const speaking = multiAgentManagerRef.current.getSpeakingAgents();
      console.log('🗣️ Speaking agents:', speaking.map(a => a.name));
      setSpeakingAgents(new Set(speaking.map(a => a.id)));
      
      // Show success message if agents responded
      const allAgents = multiAgentManagerRef.current.getAllAgents();
      if (allAgents.length > 0) {
        console.log(`✅ Message processed by ${allAgents.length} agent(s)`);
      }
    } catch (error) {
      console.error('❌ Error in multi-agent processing:', error);
      console.error('❌ Error details:', {
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      toast.error(`Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingResponse(false);
    }
  };

  const handleEndVideoCall = async () => {
    try {
      // Stop FishAudio STT and TTS - do this FIRST to stop all audio
      if (fishAudioSTTRef.current) {
        try {
          // Stop recording immediately
          await fishAudioSTTRef.current.stop();
        } catch (error) {
          console.warn('Error stopping FishAudio STT:', error);
        }
        fishAudioSTTRef.current = null;
      }
      if (fishAudioTTSRef.current) {
        try {
          // Stop all audio playback immediately
          fishAudioTTSRef.current.stop();
        } catch (error) {
          console.warn('Error stopping FishAudio TTS:', error);
        }
        fishAudioTTSRef.current = null;
      }
      
      // Clear transcript timeout
      if (transcriptTimeoutRef.current) {
        clearTimeout(transcriptTimeoutRef.current);
        transcriptTimeoutRef.current = null;
      }
      
      // Process any pending transcript before ending call
      if (pendingTranscriptRef.current.trim()) {
        const finalText = pendingTranscriptRef.current.trim();
        console.log('📤 Processing pending transcript before ending call:', finalText);
        handleRealtimeMessage(finalText);
        pendingTranscriptRef.current = "";
      }

      // Clear multi-agent manager (this will stop all TTS) - do this AFTER stopping Realtime
      if (multiAgentManagerRef.current) {
        try {
          console.log('🧹 [ChatTab] Clearing multi-agent manager and stopping all TTS');
          multiAgentManagerRef.current.clear();
          // Give TTS a moment to stop before nulling the ref
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.warn('Error clearing multi-agent manager:', error);
        }
        multiAgentManagerRef.current = null;
      }

      // Stop video stream
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        videoStreamRef.current = null;
      }

      if (userVideoRef.current) {
        userVideoRef.current.srcObject = null;
      }

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }

      setIsVideoCallActive(false);
      isVideoCallActiveRef.current = false; // Update ref
      setIsRealtimeCall(false);
      isRealtimeCallRef.current = false; // Update ref
      setIsUserVideoReady(false);
      setRealtimeTranscript("");
      // Clear call messages when call ends (they're separate from chat)
      setCallMessages([]);
      toast.success("Video call ended");
    } catch (error) {
      console.error('Error ending video call:', error);
      // Still reset state even if cleanup fails
      setIsVideoCallActive(false);
      setIsRealtimeCall(false);
      setIsUserVideoReady(false);
      setRealtimeTranscript("");
      setCallMessages([]);
      toast.error("Error ending call, but call has been stopped");
    }
  };

  // Render message content with code block support
  const renderMessageContent = (text: string) => {
    // Simple markdown code block rendering
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts: (string | { type: 'code'; language: string; content: string })[] = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      // Add code block
      parts.push({
        type: 'code',
        language: match[1] || 'text',
        content: match[2],
      });
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    if (parts.length === 0) {
      return <p>{text}</p>;
    }

    return (
      <div>
        {parts.map((part, index) => {
          if (typeof part === 'string') {
            // Regular text - preserve line breaks
            return <p key={index} className="mb-2">{part}</p>;
          } else {
            // Code block
            return (
              <pre key={index} className="bg-muted p-3 rounded-md overflow-x-auto my-2 text-xs">
                <code className={`language-${part.language}`}>{part.content}</code>
              </pre>
            );
          }
        })}
      </div>
    );
  };

  return (
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Chat
          </h2>
          <p className="text-muted-foreground mt-1">
            Voice and text communication with AI engineers
            {githubConnection && (
              <span className="ml-2 text-xs text-cyan-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Connected to {githubConnection.username}/{githubConnection.repo}
              </span>
            )}
          </p>
        </div>
        {!isVideoCallActive && (
          <Button
            onClick={handleStartVideoCall}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Video className="h-4 w-4" />
            Start Video Call
          </Button>
        )}
        {isVideoCallActive && (
          <Button
            onClick={handleEndVideoCall}
            variant="destructive"
            className="flex items-center gap-2"
          >
            <VideoOff className="h-4 w-4" />
            End Video Call
          </Button>
        )}
      </div>

      {/* Engineer Selection Dialog */}
      <Dialog open={showEngineerSelection} onOpenChange={setShowEngineerSelection}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select Engineers for Call</DialogTitle>
            <DialogDescription>
              Choose one or more engineers to join the call. They can work on parallel tasks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {getEngineers().map((engineer) => {
              const isSelected = selectedEngineerIds.has(engineer.id);
              return (
                <div
                  key={engineer.id}
                  onClick={() => {
                    const newSet = new Set(selectedEngineerIds);
                    if (isSelected) {
                      newSet.delete(engineer.id);
                    } else {
                      newSet.add(engineer.id);
                    }
                    setSelectedEngineerIds(newSet);
                  }}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-400/10'
                      : 'border-border hover:border-cyan-400/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        const newSet = new Set(selectedEngineerIds);
                        if (checked) {
                          newSet.add(engineer.id);
                        } else {
                          newSet.delete(engineer.id);
                        }
                        setSelectedEngineerIds(newSet);
                      }}
                    />
                    <Bot className="h-5 w-5 text-cyan-400" />
                    <div className="flex-1">
                      <div className="font-semibold">{engineer.name}</div>
                      {engineer.specialty && (
                        <div className="text-sm text-muted-foreground capitalize">{engineer.specialty}</div>
                      )}
                      {engineer.personality && (
                        <div className="text-xs text-muted-foreground mt-1">{engineer.personality}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowEngineerSelection(false);
                setSelectedEngineerIds(new Set());
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedEngineerIds.size === 0) {
                  toast.error('Please select at least one engineer');
                  return;
                }
                setShowEngineerSelection(false);
                startCallWithSelectedEngineers();
              }}
              disabled={selectedEngineerIds.size === 0}
            >
              Start Call with {selectedEngineerIds.size} Engineer{selectedEngineerIds.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Call Overlay - Multi-Agent Support */}
      {isVideoCallActive && (
        <Card className="border-cyan-400/50 card-3d">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-cyan-400 animate-pulse" />
                <h3 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  {isRealtimeCall ? 'Real-time' : 'Video'} Call
                  {activeAgents.length > 0 && (
                    <span className="ml-2 text-sm text-muted-foreground font-normal">
                      ({activeAgents.length} engineer{activeAgents.length !== 1 ? 's' : ''})
                    </span>
                  )}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleEndVideoCall}
              >
                <VideoOff className="h-4 w-4" />
              </Button>
            </div>
            
            {isRealtimeCall ? (
              // Real-time video call: Side-by-side layout - User video on left, AI avatars on right
              <div className="grid grid-cols-2 gap-4">
                {/* User's Video - Left Side */}
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video border-2 border-primary/50">
                  <video
                    ref={userVideoRef}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    playsInline
                    style={{ transform: 'scaleX(-1)' }} // Mirror the video for natural self-view
                  >
                    Your browser does not support the video tag.
                  </video>
                  {/* Loading indicator if video not ready - only show if stream exists but video isn't playing */}
                  {videoStreamRef.current && !isUserVideoReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                        <p className="text-sm text-white">Starting camera...</p>
                      </div>
                    </div>
                  )}
                  {/* Show message if no stream at all */}
                  {!videoStreamRef.current && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                        <p className="text-sm text-white">Requesting camera access...</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-primary/90 text-white text-xs px-2 py-1 rounded flex items-center gap-1 z-10">
                    <User className="h-3 w-3" />
                    You (Live)
                  </div>
                </div>

                {/* Multiple AI Engineers - Right Side - Grid Layout with 3D Avatars */}
                {activeAgents.length > 0 ? (
                  <div className={`grid gap-4 ${
                    activeAgents.length === 1 ? 'grid-cols-1' :
                    activeAgents.length === 2 ? 'grid-cols-1' : // 2 rows for 2 agents
                    activeAgents.length === 3 ? 'grid-cols-1' : // 3 rows for 3 agents
                    'grid-cols-1' // 4 rows for 4 agents (stacked vertically)
                  }`}>
                    {activeAgents.map((agent) => {
                      const isSpeaking = speakingAgents.has(agent.id);
                      // Use callMessages during call, messages otherwise
                      const recentMessage = (isRealtimeCall ? callMessages : messages)
                        .filter(m => m.engineerId === agent.id && m.role === 'engineer')
                        .slice(-1)[0];
                      
                      return (
                        <div
                          key={agent.id}
                          className={`relative bg-gradient-to-br from-cyan-900/20 to-cyan-700/10 rounded-lg overflow-hidden aspect-video flex items-center justify-center border-2 transition-all ${
                            isSpeaking 
                              ? 'border-cyan-400 shadow-lg shadow-cyan-400/50 scale-105' 
                              : 'border-cyan-400/30'
                          }`}
                        >
                          {/* 3D Avatar Container */}
                          <div
                            ref={(el) => {
                              if (el && !avatarContainerRefs.current.has(agent.id)) {
                                avatarContainerRefs.current.set(agent.id, el);
                                // Initialize avatar if URL is available and valid
                                if (agent.avatar_url && agent.avatar_url.length > 10 && 
                                    agent.avatar_url !== '01' && agent.avatar_url !== '01.glb' &&
                                    isVideoCallActive) {
                                  createReadyPlayerMeAvatar(
                                    agent.avatar_url,
                                    el,
                                    () => console.log(`✅ Avatar loaded for ${agent.name}`),
                                    (error) => {
                                      console.error(`❌ Error loading avatar for ${agent.name}:`, error);
                                      // Fallback to icon if avatar fails to load
                                    }
                                  ).then(avatar => {
                                    if (avatar) {
                                      avatarRefs.current.set(agent.id, avatar);
                                    }
                                  }).catch(() => {
                                    // Fallback handled in error callback
                                  });
                                } else if (agent.avatar_url && (agent.avatar_url.length <= 10 || agent.avatar_url === '01' || agent.avatar_url === '01.glb')) {
                                  console.warn(`⚠️ Invalid avatar URL for ${agent.name}: ${agent.avatar_url}`);
                                }
                              }
                            }}
                            className="w-full h-full"
                          />
                          
                          {/* Fallback icon if avatar not loaded */}
                          {!avatarRefs.current.has(agent.id) && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Bot className={`h-12 w-12 transition-all ${
                                isSpeaking ? 'text-cyan-400 scale-110' : 'text-cyan-400/70'
                              }`} />
                            </div>
                          )}
                          
                          {/* Overlay info */}
                          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1 z-10">
                            <Bot className="h-3 w-3" />
                            {agent.name}
                          </div>
                          {agent.specialty && (
                            <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded capitalize z-10">
                              {agent.specialty}
                            </div>
                          )}
                          {isGeneratingResponse && !isSpeaking && (
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded z-10">
                              Thinking...
                            </div>
                          )}
                          {isSpeaking && (
                            <div className="absolute top-2 right-2 bg-cyan-400/90 text-black text-xs px-2 py-1 rounded flex items-center gap-1 z-10">
                              <div className="w-2 h-2 bg-black rounded-full animate-pulse"></div>
                              Speaking
                            </div>
                          )}
                          {recentMessage && (
                            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded max-w-[60%] truncate z-10">
                              {recentMessage.text.substring(0, 30)}...
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="relative bg-gradient-to-br from-cyan-900/20 to-cyan-700/10 rounded-lg overflow-hidden aspect-video flex items-center justify-center border border-cyan-400/30">
                    <div className="text-center">
                      <Bot className="h-16 w-16 mx-auto mb-3 text-cyan-400" />
                      <p className="text-sm font-medium text-cyan-400">Loading engineers...</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Avatar mode (non-realtime)
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                {currentEngineer && currentEngineer.avatar_url ? (
                  <div
                    ref={(el) => {
                      if (el && !avatarContainerRefs.current.has('current')) {
                        avatarContainerRefs.current.set('current', el);
                        // Validate avatar URL before loading
                        if (currentEngineer.avatar_url && currentEngineer.avatar_url.length > 10 &&
                            currentEngineer.avatar_url !== '01' && currentEngineer.avatar_url !== '01.glb') {
                          createReadyPlayerMeAvatar(
                            currentEngineer.avatar_url!,
                            el,
                            () => console.log('✅ Avatar loaded'),
                            (error) => console.error('❌ Error loading avatar:', error)
                          ).then(avatar => {
                            if (avatar) {
                              avatarRefs.current.set('current', avatar);
                            }
                          });
                        } else {
                          console.warn('⚠️ Invalid avatar URL:', currentEngineer.avatar_url);
                        }
                      }
                    }}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Waiting for engineer response...</p>
                      <p className="text-sm mt-1">Avatar will appear here when the engineer responds</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Real-time transcript display */}
            {isRealtimeCall && realtimeTranscript && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-cyan-400/20">
                <p className="text-xs text-muted-foreground mb-1">Speaking...</p>
                <p className="text-sm">{realtimeTranscript}</p>
              </div>
            )}

            {/* Active agents info */}
            {isRealtimeCall && activeAgents.length > 1 && (
              <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">
                  {activeAgents.length} engineers working in parallel. They can interrupt each other like a real team meeting.
                  {githubConnection && (
                    <span className="ml-2 text-cyan-400">
                      • GitHub: {githubConnection.username}/{githubConnection.repo}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeAgents.map(agent => (
                    <div
                      key={agent.id}
                      className={`text-xs px-2 py-1 rounded ${
                        speakingAgents.has(agent.id)
                          ? 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/50'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {agent.name}
                      {speakingAgents.has(agent.id) && ' 🔊'}
                    </div>
                  ))}
                </div>
                {githubConnection && (
                  <div className="mt-3 pt-3 border-t border-muted">
                    <p className="text-xs text-muted-foreground mb-2">Active Branches:</p>
                    <div className="flex flex-wrap gap-2">
                      {activeAgents.map(agent => (
                        <a
                          key={agent.id}
                          href={`https://github.com/${githubConnection.username}/${githubConnection.repo}/tree/ai-engineer-${agent.id}-${agent.name.toLowerCase().replace(/\s+/g, '-')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                        >
                          {agent.name}'s branch →
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="flex flex-col h-[600px] card-3d">
        <CardContent className="flex-1 flex flex-col p-6">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto mb-4 space-y-4 scroll-smooth">
            {/* Show call messages during call, chat messages otherwise */}
            {((isRealtimeCall ? callMessages : messages).length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
                <div className="text-center">
                  <Bot className="h-16 w-16 mx-auto mb-4 text-cyan-400/50" />
                  <p className="text-lg font-medium mb-2">Welcome to DevSpace Chat</p>
                  <p className="text-sm">Type a message to start a conversation</p>
                  <p className="text-xs mt-4">Click "Start Video Call" to see your AI team in action with voice</p>
                </div>
              </div>
            ) : (
              (isRealtimeCall ? callMessages : messages).map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === 'engineer' ? 'flex-row' : 'flex-row-reverse'}`}
                >
                  {/* Avatar */}
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback
                      className={
                        message.role === 'engineer'
                          ? 'bg-cyan-400/20 text-cyan-400'
                          : 'bg-primary/20 text-primary'
                      }
                    >
                      {message.role === 'engineer' ? (
                        <Bot className="h-4 w-4" />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>

                  {/* Message Content */}
                  <div className={`flex-1 space-y-1 ${message.role === 'engineer' ? 'items-start' : 'items-end'}`}>
                    <div
                      className={`p-3 rounded-lg ${
                        message.role === 'engineer'
                          ? 'bg-cyan-400/10 border border-cyan-400/20'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          {message.role === 'engineer' && (
                            <p className="text-xs font-medium text-cyan-400 mb-1">Engineer</p>
                          )}
                          <div className="text-sm whitespace-pre-wrap">
                            {renderMessageContent(message.text)}
                          </div>
                          {githubConnection && message.role === 'engineer' && (
                            <div className="mt-2 pt-2 border-t border-cyan-400/20 space-y-1">
                              <a
                                href={`https://github.com/${githubConnection.username}/${githubConnection.repo}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View on GitHub
                              </a>
                              {message.engineerId && (
                                <a
                                  href={`https://github.com/${githubConnection.username}/${githubConnection.repo}/tree/ai-engineer-${message.engineerId}-${activeAgents.find(a => a.id === message.engineerId)?.name.toLowerCase().replace(/\s+/g, '-') || 'engineer'}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  View Engineer's Branch
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                        {message.role === 'engineer' && (
                          <div className="flex gap-1">
                            {message.audioUrl && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => handlePlayAudio(message.audioUrl!, message.id)}
                              >
                                {playingAudioId === message.id ? (
                                  <Pause className="h-3 w-3" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={async () => {
                                try {
                                  const engineersList = getEngineers();
                                  if (engineersList.length === 0) {
                                    toast.error("No engineer available");
                                    return;
                                  }

                                  const engineer = engineersList[0];
                                  const { saveTask, generateId } = await import('@/lib/localstorage-data');
                                  
                                  saveTask({
                                    id: generateId(),
                                    description: `Task from chat: ${message.text.substring(0, 200)}`,
                                    engineer_id: engineer.id,
                                    status: 'pending',
                                    output: null,
                                    created_at: new Date().toISOString(),
                                  });

                                  toast.success("Task assigned successfully!");
                                } catch (error) {
                                  console.error('Error assigning task:', error);
                                  toast.error("Failed to assign task");
                                }
                              }}
                              title="Assign as task"
                            >
                              <ListTodo className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
            {isGeneratingResponse && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-cyan-400/20 text-cyan-400">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="p-3 rounded-lg bg-cyan-400/10 border border-cyan-400/20">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                      <p className="text-sm text-muted-foreground">
                        {analyzingFile ? (
                          <>
                            <span className="text-cyan-400">Analyzing</span> {analyzingFile}...
                          </>
                        ) : (
                          <>
                            <span className="text-cyan-400">Engineer</span> is thinking...
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="space-y-4 border-t pt-4">
            {/* Transcript Display */}
            {transcript && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm font-medium mb-1 text-primary">Latest Transcript:</p>
                <p className="text-sm whitespace-pre-wrap">{transcript}</p>
              </div>
            )}

            {/* Input Controls - Text only (voice is in video call) */}
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 min-h-[80px] resize-none"
                disabled={isUploading || isGeneratingResponse}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button
                type="button"
                onClick={handleSendMessage}
                disabled={!input.trim() || isUploading || isGeneratingResponse}
                size="default"
                className="h-[80px] px-6"
              >
                {isUploading || isGeneratingResponse ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Send'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

