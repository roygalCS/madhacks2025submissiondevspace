# Real-Time Video Call Feature

## Overview

Implemented a real-time FaceTime-like video call feature using:
- **WebRTC** for user's camera feed
- **FishAudio STT** for real-time speech-to-text (chunked streaming)
- **Web Speech API** for real-time text-to-speech (with FishAudio fallback)
- **Split-screen UI** showing user video + AI engineer avatar

## How It Works

### Real-Time Flow

1. **User clicks "Start Video Call"**
   - Requests camera and microphone access
   - Starts user's video feed (WebRTC)
   - Initializes real-time STT (FishAudio chunked processing)
   - Initializes real-time TTS (Web Speech API)

2. **User speaks**
   - Audio is captured in 2-second chunks
   - Each chunk is sent to FishAudio STT immediately
   - Partial transcripts appear in real-time
   - Final transcript triggers AI response

3. **AI responds**
   - OpenRouter generates response
   - Real-time TTS speaks the response immediately
   - Response appears in chat
   - No pre-generated videos (real-time feel)

### Key Features

- **Split-screen video**: User's camera on left, AI avatar on right
- **Live transcript**: Shows what you're saying as you speak
- **Real-time TTS**: AI speaks responses immediately (no waiting for video generation)
- **Seamless integration**: Works with existing chat system

## Technical Implementation

### New Files Created

1. **`src/lib/realtime-stt.ts`**
   - `RealtimeSTT` class for chunked STT processing
   - Processes audio in 2-second chunks
   - Calls FishAudio STT API for each chunk
   - Provides partial and final transcripts

2. **`src/lib/realtime-tts.ts`**
   - `RealtimeTTS` class for real-time TTS
   - Uses Web Speech API (browser built-in) for instant TTS
   - Falls back to FishAudio TTS if Web Speech API unavailable
   - Supports voice selection

### Updated Components

**`src/components/dashboard/ChatTab.tsx`**
- Added `isRealtimeCall` state to distinguish real-time vs pre-generated
- Added `realtimeTranscript` for live transcript display
- Added `userVideoRef` for user's camera feed
- Added `videoStreamRef` for WebRTC stream management
- Updated `handleStartVideoCall` to start real-time call
- Updated `sendToOpenRouter` to support real-time mode
- Updated video call UI for split-screen display

## Usage

### Starting a Real-Time Call

1. Click "Start Video Call" button
2. Allow camera and microphone permissions
3. Your video appears on the left
4. AI engineer avatar appears on the right
5. Start speaking - your words appear in real-time

### During the Call

- **Speak naturally**: The system captures your speech in chunks
- **See live transcript**: Your words appear as you speak
- **Get instant responses**: AI responds and speaks immediately
- **View chat history**: All messages appear in the chat below

### Ending the Call

- Click "End Video Call" button
- All streams are stopped
- Camera and microphone are released
- Chat history is preserved

## Comparison: Real-Time vs Pre-Generated

| Feature | Real-Time Call | Pre-Generated Videos |
|---------|---------------|---------------------|
| **User Video** | ✅ Live camera feed | ❌ No user video |
| **AI Avatar** | ✅ Static avatar (can be enhanced) | ✅ Pre-generated videos |
| **Latency** | ⚡ Low (real-time) | ⏱️ Higher (video generation time) |
| **STT** | ✅ Chunked streaming | ✅ One-time upload |
| **TTS** | ✅ Instant (Web Speech API) | ⏱️ Async (FishAudio) |
| **Feel** | 🎯 Like FaceTime | 📹 Like video messages |

## Future Enhancements

1. **Real-time avatar animation**: Use Ready Player Me or similar for animated avatars
2. **Better voice selection**: Allow users to choose TTS voice
3. **Screen sharing**: Add ability to share screen during call
4. **Recording**: Option to record video calls
5. **Multiple engineers**: Support for multiple AI engineers in one call

## Configuration

### Environment Variables

```bash
# Required for STT
VITE_FISHAUDIO_API_KEY=your_key_here

# Optional for TTS fallback
VITE_FISHAUDIO_DEFAULT_VOICE_ID=voice_id_here

# Required for AI responses
VITE_OPENROUTER_API_KEY=your_key_here
```

### Browser Requirements

- **WebRTC support**: Modern browsers (Chrome, Firefox, Safari, Edge)
- **Web Speech API**: Chrome, Edge (Safari has limited support)
- **Camera/Microphone**: User must grant permissions

## Troubleshooting

### Camera/Microphone Not Working
- Check browser permissions
- Ensure HTTPS (required for WebRTC in production)
- Try different browser

### TTS Not Speaking
- Check if Web Speech API is available (Chrome/Edge recommended)
- Falls back to FishAudio TTS automatically
- Check browser console for errors

### STT Not Working
- Verify FishAudio API key is set
- Check network connection
- Ensure microphone permissions granted

## Code Structure

```
src/
├── lib/
│   ├── realtime-stt.ts      # Real-time STT class
│   └── realtime-tts.ts      # Real-time TTS class
└── components/
    └── dashboard/
        └── ChatTab.tsx      # Updated with real-time call
```

## API Integration

### FishAudio STT
- Endpoint: `/api/stt` (proxied via Vite)
- Method: POST with FormData
- Response: JSON with transcript

### Web Speech API
- Built into browser
- No API key required
- Instant TTS generation

### OpenRouter
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Used for AI responses
- Same as regular chat mode

