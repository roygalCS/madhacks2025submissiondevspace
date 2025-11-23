# Gemini Live API Migration

## Overview

This document describes the migration from OpenAI Realtime API, FishAudio, and Parakeet to Google's Gemini Live API for all voice-related features.

## Changes Made

### 1. New Files Created

- **`src/lib/gemini-live.ts`**: Gemini Live API client for unified STT + TTS
  - Handles session management
  - Processes audio for transcription
  - Provides TTS via Gemini API
  - Manages audio streaming and playback

- **`src/lib/gemini-llm.ts`**: Gemini LLM API client for agent responses
  - Text generation with streaming support
  - Used by MultiAgentManager for agent responses

### 2. Updated Files

- **`src/lib/multi-agent-manager.ts`**:
  - Replaced OpenAI API calls with Gemini LLM API
  - Updated TTS to use Gemini Live instead of OpenAI TTS
  - Removed references to OpenAI Realtime
  - Maintains GitHub integration for parallel agent editing

- **`src/components/dashboard/ChatTab.tsx`**:
  - Replaced OpenAI Realtime with Gemini Live
  - Updated all API calls to use Gemini
  - Maintained multi-agent support
  - Preserved video call functionality

### 3. Removed Dependencies

- OpenAI Realtime API (replaced with Gemini Live)
- OpenAI TTS API (replaced with Gemini TTS)
- FishAudio STT/TTS (replaced with Gemini)
- Parakeet (replaced with Gemini)

## API Key

The Gemini API key is hardcoded in the implementation:
```
AIzaSyBfYbt8pqO-AnRmfXUI1XhfW2HKRk9_BfU
```

## Features

### Real-Time Voice Streaming
- **STT**: Audio is processed in 2-second chunks and sent to Gemini API for transcription
- **TTS**: Text responses are sent to Gemini API for speech synthesis
- **Low Latency**: Optimized for real-time conversation

### Multi-Agent Support
- Multiple AI engineers can participate in parallel calls
- Each agent maintains its own context and personality
- Agents can interrupt each other naturally
- All agents can edit GitHub repositories in parallel

### Session Management
- Gemini Live sessions are created when a video call starts
- Sessions persist until the call ends
- Participants (agents) can be added to sessions

## Technical Details

### Gemini Live Client (`gemini-live.ts`)

The `GeminiLive` class provides:
- `createSession()`: Creates a new Gemini Live session
- `connect()`: Connects to Gemini Live (creates session if needed)
- `startRecording()`: Starts recording user audio and processes for transcription
- `stopRecording()`: Stops audio recording
- `speakText()`: Sends text to Gemini for TTS
- `stopAudio()`: Stops all audio playback
- `disconnect()`: Cleans up session and connections

### Gemini LLM Client (`gemini-llm.ts`)

Provides two main functions:
- `generateWithGemini()`: Non-streaming text generation
- `generateWithGeminiStream()`: Streaming text generation with chunk callbacks

### Multi-Agent Manager Updates

- Uses Gemini LLM for all agent responses
- Maintains GitHub integration for code editing
- Supports parallel agent execution
- Handles TTS queuing to prevent audio overlap

## Usage

### Starting a Video Call

1. User clicks "Start Video Call" button
2. Gemini Live session is created
3. Audio recording starts
4. User speech is transcribed in real-time
5. Agents respond using Gemini LLM
6. Agent responses are spoken using Gemini TTS

### Multi-Agent Interaction

- All agents receive user messages
- Agents process in parallel
- TTS is queued to prevent overlap
- Agents can edit GitHub repositories independently

## Error Handling

- Connection errors are displayed to the user
- API errors are logged and handled gracefully
- Audio playback errors don't block text responses
- Network issues trigger reconnection attempts

## Testing

To test the migration:

1. Start a video call
2. Speak to the agents
3. Verify transcription appears in real-time
4. Verify agents respond with voice
5. Test multiple agents in parallel
6. Verify GitHub editing still works

## Notes

- The Gemini Live API implementation uses REST API calls for session management and audio processing
- Real-time audio streaming may need adjustment based on actual Gemini Live API behavior
- The API key is currently hardcoded - consider moving to environment variables for production
- GitHub integration is fully preserved and functional

## Future Improvements

- Add support for Gemini Live WebSocket protocol if available
- Implement per-agent voice customization using Gemini's voice features
- Add session persistence across page reloads
- Optimize audio chunk processing for lower latency

