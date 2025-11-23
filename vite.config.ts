import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      clientPort: 8080,
      protocol: 'ws',
    },
    proxy: {
      // FishAudio STT proxy (to avoid CORS issues)
      '/api/stt': {
        target: 'https://api.fish.audio',
        changeOrigin: true,
        rewrite: (path) => '/v1/asr',
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Transform X-FishAudio-API-Key header to Authorization Bearer
            const apiKey = req.headers['x-fishaudio-api-key'];
            if (apiKey) {
              proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
              proxyReq.removeHeader('x-fishaudio-api-key');
            }
            proxyReq.setHeader('Accept', 'application/json');
          });
        },
      },
      // FishAudio TTS proxy (to avoid CORS issues)
      '/api/tts': {
        target: 'https://api.fish.audio',
        changeOrigin: true,
        rewrite: (path) => '/v1/tts',
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Transform X-API-Key header to Authorization Bearer
            const apiKey = req.headers['x-api-key'];
            if (apiKey) {
              proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
              proxyReq.removeHeader('x-api-key');
            }
            proxyReq.setHeader('Content-Type', 'application/json');
            proxyReq.setHeader('model', 's1');
          });
        },
      },
      // GitHub OAuth token exchange proxy (to avoid CORS issues)
      '/api/github/oauth/token': {
        target: 'https://github.com',
        changeOrigin: true,
        rewrite: (path) => '/login/oauth/access_token',
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Set proper headers for GitHub OAuth
            proxyReq.setHeader('Accept', 'application/json');
            proxyReq.setHeader('Content-Type', 'application/json');
          });
        },
      },
    },
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

