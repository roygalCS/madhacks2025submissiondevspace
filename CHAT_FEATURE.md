# Chat Feature with Voice Recording and AI Responses

## Overview
This document describes the voice-enabled chat feature that integrates FishAudio STT, OpenRouter AI, and FishAudio TTS for a complete voice-to-voice conversation experience.

## Features

### 1. Voice Recording
- Click the microphone button to start recording
- Click again to stop recording
- Audio is recorded in WebM format with Opus codec
- Visual feedback: button turns red when recording, shows loading spinner during processing

### 2. Speech-to-Text (STT)
- Recorded audio is uploaded to `/api/stt` endpoint via FormData
- FishAudio API key is included in request headers
- Transcript is extracted and displayed as a user message

### 3. AI Response Generation
- After transcription, the transcript is automatically sent to OpenRouter API
- Uses `meta-llama/llama-3-8b-instruct` model
- Response is displayed as an "Engineer" message with distinct styling

### 4. Text-to-Speech (TTS)
- After receiving AI response, FishAudio TTS is called to generate audio
- Play button appears on engineer messages with audio
- Click play to hear the AI-generated voice response

## Component Structure

### ChatTab Component
Location: `src/components/dashboard/ChatTab.tsx`

**Key Features:**
- Message types: `user` and `engineer`
- Distinct styling for each message type
- Avatar icons (User icon for user, Bot icon for engineer)
- Audio playback controls
- Loading states for all async operations

**State Management:**
- `isRecording`: Tracks recording state
- `isUploading`: Tracks STT upload state
- `isGeneratingResponse`: Tracks OpenRouter API call state
- `messages`: Array of message objects with role, text, timestamp, and optional audioUrl
- `playingAudioId`: Tracks which audio is currently playing

## API Integration

### FishAudio STT
- **Endpoint**: `/api/stt` (backend endpoint)
- **Method**: POST
- **Headers**: 
  - `X-FishAudio-API-Key: your_fishaudio_api_key_here`
- **Body**: FormData with audio blob
- **Response**: JSON with transcript text

### OpenRouter API
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Method**: POST
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer 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`
- **Body**:
  ```json
  {
    "model": "meta-llama/llama-3-8b-instruct",
    "messages": [
      {
        "role": "user",
        "content": "<transcript>"
      }
    ]
  }
  ```
- **Response**: JSON with AI response in `choices[0].message.content`

### FishAudio TTS
- **Endpoint**: `https://api.fish.audio/api/v1/tts`
- **Method**: POST
- **Headers**:
  - `Content-Type: application/json`
  - `X-API-Key: <VITE_FISHAUDIO_API_KEY>`
- **Body**:
  ```json
  {
    "text": "<engineer_response>",
    "voice": "<voice_id>"
  }
  ```
- **Voice IDs**: Fish Audio uses specific voice IDs (not names). Valid voice IDs include:
  - `8ef4a238714b45718ce04243307c57a7` (E-girl)
  - `802e3bc2b27e49c2995d23ef70e6ac89` (Energetic Male) - recommended for engineer voice
  - `933563129e564b19a115bedd57b7406a` (Sarah)
  - `bf322df2096a46f18c579d0baa36f41d` (Adrian)
  - `b347db033a6549378b48d00acb0d06cd` (Selene)
  - `536d3a5e000945adb7038665781a4aca` (Ethan)
- **Response**: Audio blob or JSON with audio URL
- **Reference**: [Fish Audio Documentation](https://docs.fish.audio/developer-guide/getting-started/introduction)

## Error Handling

All API calls include comprehensive error handling:
- **Microphone access errors**: Toast notification with permission guidance
- **STT upload errors**: Toast notification with retry suggestion
- **OpenRouter API errors**: Toast notification with error message from API
- **TTS errors**: Silent failure (optional feature, doesn't block conversation)

## Styling

### User Messages
- Right-aligned with User avatar
- Background: `bg-muted`
- Avatar: Primary color theme

### Engineer Messages
- Left-aligned with Bot avatar
- Background: `bg-cyan-400/10` with `border-cyan-400/20`
- Avatar: Cyan color theme
- Label: "Engineer" text in cyan
- Play button: Ghost variant, appears when audio is available

### Loading States
- Recording: Red button with pulse animation
- Uploading/Generating: Loading spinner
- Thinking indicator: Shows "Engineer is thinking..." with spinner

## Testing

### Manual Testing Checklist

1. **Microphone Recording**
   - [ ] Click microphone button - should start recording
   - [ ] Button turns red and shows MicOff icon
   - [ ] Click again - should stop recording
   - [ ] Verify toast notification appears

2. **STT Integration**
   - [ ] Record audio and stop
   - [ ] Verify transcript appears in messages
   - [ ] Check transcript display below input area
   - [ ] Verify user message appears with User avatar

3. **OpenRouter Integration**
   - [ ] After transcript, verify "Engineer is thinking..." appears
   - [ ] Verify engineer response appears with Bot avatar
   - [ ] Check engineer message styling (cyan theme)
   - [ ] Verify timestamp is displayed

4. **TTS Integration**
   - [ ] Verify play button appears on engineer messages
   - [ ] Click play - audio should play
   - [ ] Button should change to pause while playing
   - [ ] Click pause - audio should stop
   - [ ] Verify only one audio plays at a time

5. **Error Handling**
   - [ ] Test with microphone permission denied
   - [ ] Test with network offline
   - [ ] Test with invalid API responses
   - [ ] Verify appropriate error toasts appear

6. **UI/UX**
   - [ ] Verify messages scroll properly
   - [ ] Check responsive design on different screen sizes
   - [ ] Verify loading states are clear
   - [ ] Check that buttons are disabled during processing

### API Testing

To test the APIs independently:

```bash
# Test STT endpoint (requires backend)
curl -X POST http://localhost:8080/api/stt \
  -H "X-FishAudio-API-Key: your_fishaudio_api_key_here" \
  -F "audio=@recording.webm"

# Test OpenRouter API
curl -X POST https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_openrouter_api_key_here" \
  -d '{
    "model": "meta-llama/llama-3-8b-instruct",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# Test FishAudio TTS
curl -X POST https://api.fish.audio/api/v1/tts \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_fishaudio_api_key_here" \
  -d '{"text": "Hello world", "voice": "default"}'
```

## Configuration

### Environment Variables
API keys are now stored in environment variables for security. Create a `.env` file in the project root:

```bash
# FishAudio API Key for Speech-to-Text and Text-to-Speech
VITE_FISHAUDIO_API_KEY=your_fishaudio_api_key_here

# OpenRouter API Key for AI chat completions
VITE_OPENROUTER_API_KEY=your_openrouter_api_key_here

# OpenRouter Model (optional, defaults to meta-llama/llama-3-8b-instruct)
VITE_OPENROUTER_MODEL=meta-llama/llama-3-8b-instruct
```

**Important Notes:**
- The `.env` file is gitignored and should not be committed
- Copy `.env.example` to `.env` and fill in your actual API keys
- All environment variables must be prefixed with `VITE_` to be accessible in the frontend
- Restart the dev server after changing environment variables

### Model Configuration
The OpenRouter model can be changed by setting the `VITE_OPENROUTER_MODEL` environment variable. If not set, it defaults to `meta-llama/llama-3-8b-instruct`.

### Voice Configuration
The FishAudio TTS voice can be customized via:
1. **Environment Variable**: Set `VITE_FISHAUDIO_DEFAULT_VOICE_ID` in your `.env` file
2. **Engineer-specific**: Use the engineer's `fish_voice_id` from the database (future enhancement)
3. **Default Fallback**: Uses "Energetic Male" voice ID (`802e3bc2b27e49c2995d23ef70e6ac89`) if not specified

Valid voice IDs are UUIDs from Fish Audio. See the [Fish Audio documentation](https://docs.fish.audio/developer-guide/getting-started/introduction) for available voices.

## Known Limitations

1. **TTS Endpoint**: The FishAudio TTS endpoint may need adjustment based on actual API documentation
2. **Audio Format**: Currently assumes WebM format - may need format conversion for some backends
3. **CORS**: FishAudio TTS API may require CORS configuration on backend
4. **Voice Selection**: Currently uses 'default' voice - may need to select from available voices

## Future Enhancements

- [ ] Support for text input in addition to voice
- [ ] Conversation history persistence
- [ ] Multiple engineer personalities
- [ ] Voice selection dropdown
- [ ] Audio waveform visualization
- [ ] Conversation export
- [ ] Rate limiting and quota management

## Dependencies

- `lucide-react`: Icons (Mic, Bot, User, Play, Pause, etc.)
- `sonner`: Toast notifications
- `@radix-ui/react-avatar`: Avatar components
- Native browser APIs: MediaRecorder, Audio

## Browser Compatibility

- Requires modern browser with MediaRecorder API support
- Chrome, Firefox, Edge (latest versions)
- Safari may require additional configuration for MediaRecorder

