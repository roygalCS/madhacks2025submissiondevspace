/**
 * Vite plugin to proxy OpenAI Realtime WebSocket with proper authentication
 */
import type { Plugin } from 'vite';
import { WebSocketServer, WebSocket as WS } from 'ws';

export function realtimeProxyPlugin(): Plugin {
  return {
    name: 'realtime-proxy',
    configureServer(server) {
      const httpServer = server.httpServer;
      if (!httpServer) return;

      // Create WebSocket server to handle client connections
      const wss = new WebSocketServer({ noServer: true });

      httpServer.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url || '', `http://${request.headers.host}`);
        
        // Only handle /api/realtime WebSocket connections
        if (url.pathname === '/api/realtime') {
          const apiKey = url.searchParams.get('api_key');
          const model = url.searchParams.get('model') || 'gpt-4o-realtime-preview-2024-10-01';
          
          if (!apiKey) {
            console.error('❌ No API key provided');
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }
          
          const decodedApiKey = decodeURIComponent(apiKey);
          const targetUrl = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;
          
          console.log('🔌 Proxying WebSocket to OpenAI Realtime API');
          
          // Handle the WebSocket upgrade using WebSocketServer
          wss.handleUpgrade(request, socket, head, (clientWs) => {
            // Create WebSocket connection to OpenAI
            const openaiWs = new WS(targetUrl, {
              headers: {
                'Authorization': `Bearer ${decodedApiKey}`,
                'OpenAI-Beta': 'realtime=v1',
              },
            });
            
            openaiWs.on('open', () => {
              console.log('✅ [Proxy] Connected to OpenAI Realtime API');
            });
            
            openaiWs.on('error', (error) => {
              console.error('❌ [Proxy] OpenAI WebSocket error:', error);
              if (clientWs.readyState === WS.OPEN || clientWs.readyState === WS.CONNECTING) {
                clientWs.close(1011, 'OpenAI connection error');
              }
            });
            
            // Pipe messages from OpenAI to client
            openaiWs.on('message', (data, isBinary) => {
              try {
                if (clientWs.readyState === WS.OPEN) {
                  // Forward binary data as-is, JSON strings as text
                  clientWs.send(data, { binary: isBinary });
                  if (isBinary) {
                    console.log('🔊 [Proxy] Forwarded binary audio chunk to client');
                  }
                } else {
                  console.warn('⚠️ [Proxy] Client WebSocket not open, dropping message');
                }
              } catch (error) {
                console.error('❌ [Proxy] Error forwarding message to client:', error);
              }
            });
            
            // Pipe messages from client to OpenAI
            clientWs.on('message', (data, isBinary) => {
              try {
                if (openaiWs.readyState === WS.OPEN) {
                  // Forward binary data as-is, JSON strings as text
                  openaiWs.send(data, { binary: isBinary });
                } else {
                  console.warn('⚠️ [Proxy] OpenAI WebSocket not open, dropping message');
                }
              } catch (error) {
                console.error('❌ [Proxy] Error forwarding message to OpenAI:', error);
              }
            });
            
            clientWs.on('close', (code, reason) => {
              console.log(`🔌 [Proxy] Client disconnected: ${code} ${reason?.toString() || ''}`);
              if (openaiWs.readyState === WS.OPEN || openaiWs.readyState === WS.CONNECTING) {
                openaiWs.close();
              }
            });
            
            openaiWs.on('close', (code, reason) => {
              console.log(`🔌 [Proxy] OpenAI connection closed: ${code} ${reason?.toString() || ''}`);
              if (clientWs.readyState === WS.OPEN || clientWs.readyState === WS.CONNECTING) {
                clientWs.close(code, reason);
              }
            });
            
            clientWs.on('error', (error) => {
              console.error('❌ [Proxy] Client WebSocket error:', error);
              if (openaiWs.readyState === WS.OPEN || openaiWs.readyState === WS.CONNECTING) {
                openaiWs.close(1011, 'Client error');
              }
            });
          });
        }
      });
    },
  };
}

