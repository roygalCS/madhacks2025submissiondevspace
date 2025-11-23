# NVIDIA Parakeet STT Setup

## Overview

This application now uses **NVIDIA Parakeet** for Speech-to-Text (STT) and **FishAudio** for Text-to-Speech (TTS).

## Environment Variables

Add these to your `.env` file:

```bash
# NVIDIA Parakeet (for STT)
VITE_PARAKET_API_KEY=your_parakeet_api_key_here

# Optional: Custom Parakeet endpoint (if not using proxy)
VITE_PARAKET_API_URL=https://your-parakeet-endpoint.com/v1/transcribe

# Optional: Parakeet function ID (for NVIDIA NIM)
VITE_PARAKET_FUNCTION_ID=your-function-id

# FishAudio (for TTS only)
VITE_FISHAUDIO_API_KEY=your_fishaudio_api_key_here
VITE_FISHAUDIO_DEFAULT_VOICE_ID=802e3bc2b27e49c2995d23ef70e6ac89
```

## API Configuration

### Proxy Setup (vite.config.ts)

The proxy is configured to forward `/api/stt` requests to NVIDIA Parakeet. Update the proxy configuration based on your Parakeet endpoint:

1. **NVIDIA NIM (NVIDIA Inference Microservices)**:
   - Default target: `https://api.nvcf.nvidia.com`
   - Path format: `/v1/nvcf/pexec/functions/{function_id}`
   - Set `VITE_PARAKET_FUNCTION_ID` in your `.env`

2. **Direct Parakeet API**:
   - Update `target` in `vite.config.ts` to your Parakeet endpoint
   - Update the `rewrite` path to match your API structure

### Authentication

Parakeet uses Bearer token authentication:
- Header: `Authorization: Bearer {api_key}`
- The API key is passed from `VITE_PARAKET_API_KEY`

## Audio Format Support

### Input Formats (from MediaRecorder)
- **WebM** (Chrome/Firefox) - ✅ Converted to WAV
- **MP4/M4A** (Safari) - ✅ Converted to WAV
- **OGG** - ✅ Converted to WAV

### Output Format (to Parakeet)
- **WAV (PCM)** - ✅ Required format
- Sample rate: 16kHz or higher (auto-converted)
- Bit depth: 16-bit PCM
- Channels: Mono or Stereo (auto-converted)

## How It Works

1. **Recording**: MediaRecorder captures audio in browser-native format (WebM/MP4)
2. **Conversion**: Audio is converted to WAV using Web Audio API
3. **Transcription**: WAV file is sent to NVIDIA Parakeet API
4. **Response**: Parakeet returns transcribed text
5. **TTS**: Text is sent to FishAudio for speech synthesis

## Testing

1. Start the video call
2. Speak into your microphone
3. Audio is automatically converted to WAV and sent to Parakeet
4. Transcript appears in real-time
5. AI agents respond via FishAudio TTS

## Troubleshooting

### "NVIDIA Parakeet API key is not configured"
- Add `VITE_PARAKET_API_KEY` to your `.env` file
- Restart the dev server

### Audio conversion errors
- Check browser console for conversion logs
- Ensure microphone permissions are granted
- Try a different browser (Chrome/Firefox recommended)

### API errors
- Verify your Parakeet API key is correct
- Check the proxy configuration in `vite.config.ts`
- Ensure the endpoint URL matches your Parakeet setup

## API Response Format

Parakeet typically returns:
```json
{
  "text": "transcribed text here"
}
```

Or:
```json
{
  "transcript": "transcribed text here"
}
```

The code handles multiple response formats automatically.

