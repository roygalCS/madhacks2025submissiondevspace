# OpenAI Realtime API Integration

## Overview

OpenAI Realtime API provides unified STT + TTS in a single WebSocket connection, offering:
- **Lower latency**: ~500ms vs 2-4s with separate services
- **Unified API**: One connection for both speech-to-text and text-to-speech
- **Better quality**: GPT-4o powered transcription and natural voice synthesis
- **Cost**: ~$0.06/minute (cheaper than separate Deepgram + FishAudio)

## Pricing

- **Free Tier**: New OpenAI accounts get $5-18 in free credits
- **Realtime API**: ~$0.06/minute for `gpt-4o-realtime-preview-2024-10-01`
- **Comparison**:
  - Deepgram: ~$0.0043/minute
  - FishAudio: ~$0.01-0.02/minute
  - **Total**: ~$0.014-0.024/minute
  - **OpenAI Realtime**: ~$0.06/minute (but much faster and better quality)

## Setup Required

### 1. Backend Proxy (Required)

The OpenAI Realtime API requires authentication via headers, which browsers can't set on WebSocket connections. You need a backend proxy.

#### Option A: Simple Node.js Proxy

Create `server/proxy-realtime.js`:

```javascript
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);

// WebSocket proxy for OpenAI Realtime
server.on('upgrade', (request, socket, head) => {
  if (request.url.startsWith('/api/realtime')) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      socket.destroy();
      return;
    }

    // Parse model from query
    const url = new URL(request.url, 'http://localhost');
    const model = url.searchParams.get('model') || 'gpt-4o-realtime-preview-2024-10-01';
    
    // Connect to OpenAI Realtime API
    const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}`;
    const ws = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    ws.on('open', () => {
      socket.pipe(ws);
      ws.pipe(socket);
    });

    ws.on('error', (error) => {
      console.error('OpenAI Realtime WebSocket error:', error);
      socket.destroy();
    });
  }
});

server.listen(3001, () => {
  console.log('Realtime proxy server running on port 3001');
});
```

#### Option B: Vite Proxy (Simpler, but less secure)

Add to `vite.config.ts`:

```typescript
proxy: {
  '/api/realtime': {
    target: 'wss://api.openai.com',
    ws: true,
    changeOrigin: true,
    rewrite: (path) => '/v1/realtime',
    configure: (proxy, _options) => {
      proxy.on('proxyReqWs', (proxyReq, req, socket) => {
        const apiKey = process.env.VITE_OPENAI_API_KEY;
        if (apiKey) {
          // Note: This won't work in browser - need backend proxy
          console.warn('⚠️ WebSocket auth must be handled server-side');
        }
      });
    },
  },
}
```

**Note**: Vite proxy can't add auth headers to WebSocket connections. You need a backend server.

### 2. Environment Variables

Add to `.env`:

```bash
# OpenAI API Key (for Realtime API)
VITE_OPENAI_API_KEY=your_openai_api_key_here

# OpenAI Realtime Model (optional)
VITE_OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2024-10-01

# Backend proxy URL (if using separate backend)
VITE_OPENAI_REALTIME_PROXY=ws://localhost:3001/api/realtime
```

### 3. Usage

The `OpenAIRealtime` class is already created in `src/lib/openai-realtime.ts`. 

To use it in `ChatTab.tsx`:

```typescript
import { OpenAIRealtime } from '@/lib/openai-realtime';

// Replace Deepgram STT + FishAudio TTS with:
const realtimeRef = useRef<OpenAIRealtime | null>(null);

// Initialize
realtimeRef.current = new OpenAIRealtime({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  model: import.meta.env.VITE_OPENAI_REALTIME_MODEL,
  voice: 'alloy', // or 'echo', 'fable', 'onyx', 'nova', 'shimmer'
  onTranscript: (text, isFinal) => {
    // Handle transcript
    if (isFinal) {
      handleRealtimeMessage(text);
    }
  },
  onAudioChunk: (audioBase64) => {
    // Audio chunks are automatically played
  },
});

// Start
await realtimeRef.current.connect();
await realtimeRef.current.startRecording();

// Stop
realtimeRef.current.stopRecording();
realtimeRef.current.disconnect();
```

## Migration Steps

1. **Set up backend proxy** (see above)
2. **Add OpenAI API key** to `.env`
3. **Update ChatTab.tsx** to use `OpenAIRealtime` instead of `RealtimeSTT` + `RealtimeTTS`
4. **Test** the connection and verify latency improvements

## Benefits

✅ **2-4x faster** response times (500ms vs 2-4s)
✅ **Unified API** - no need to manage separate STT/TTS services
✅ **Better quality** - GPT-4o powered transcription
✅ **Natural interruptions** - built-in voice activity detection
✅ **Lower complexity** - one connection instead of two

## Trade-offs

⚠️ **Requires backend proxy** - can't use directly from browser
⚠️ **Slightly more expensive** - ~$0.06/min vs ~$0.02/min
⚠️ **Newer API** - may have occasional issues

## Recommendation

For production, the latency improvement (2-4x faster) is worth the extra cost and setup complexity. The unified API also simplifies the codebase significantly.

