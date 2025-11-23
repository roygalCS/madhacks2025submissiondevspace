/**
 * Express server for OpenAI Realtime API WebSocket proxy
 * Handles authentication headers properly for WebSocket connections
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const http = require('http');
const { WebSocket } = require('ws');

const app = express();
const PORT = 3001; // Different port from Vite dev server

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// WebSocket proxy for OpenAI Realtime API
const server = http.createServer(app);

server.on('upgrade', (req, socket, head) => {
  // Extract API key from query string
  const url = new URL(req.url, `http://${req.headers.host}`);
  const apiKey = url.searchParams.get('api_key');
  const model = url.searchParams.get('model') || 'gpt-4o-realtime-preview-2024-10-01';

  if (!apiKey) {
    console.error('❌ No API key provided in query string');
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  // Decode the API key (it's URL encoded)
  const decodedApiKey = decodeURIComponent(apiKey);

  console.log('🔌 WebSocket upgrade request:', {
    path: req.url,
    hasApiKey: !!decodedApiKey,
    model: model
  });

  // Create WebSocket connection to OpenAI
  const targetUrl = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;
  const ws = new WebSocket(targetUrl, {
    headers: {
      'Authorization': `Bearer ${decodedApiKey}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  ws.on('open', () => {
    console.log('✅ Connected to OpenAI Realtime API');
    // Pipe data between client and OpenAI
    socket.pipe(ws);
    ws.pipe(socket);
  });

  ws.on('error', (error) => {
    console.error('❌ OpenAI WebSocket error:', error);
    socket.destroy();
  });

  socket.on('error', (error) => {
    console.error('❌ Client socket error:', error);
    ws.close();
  });

  socket.on('close', () => {
    console.log('🔌 Client disconnected');
    ws.close();
  });

  ws.on('close', () => {
    console.log('🔌 OpenAI connection closed');
    socket.destroy();
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Realtime proxy server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket proxy: ws://localhost:${PORT}/api/realtime`);
});

