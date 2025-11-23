# 🚀 DevSpace AI Co-Pilot

> **Hackathon-Ready AI Engineering Platform**  
> Voice-powered AI engineers that work in parallel, powered by FishAudio, Supabase, and Windmill.

## ✨ Features

- 🎤 **Real-Time Voice Interaction** - Speak naturally with AI engineers using FishAudio STT/TTS
- 👥 **Multi-Agent Collaboration** - Multiple AI engineers work in parallel on different tasks
- 🔄 **Workflow Automation** - Integrate Windmill workflows for complex task execution
- 💾 **Supabase Integration** - Robust data storage and real-time synchronization
- 🎨 **3D Avatars** - Ready Player Me avatars for immersive video calls
- 🔗 **GitHub Integration** - Direct repository access and parallel editing

## 🏗️ Architecture

This application uses **ONLY** the following services:

- **FishAudio** - Speech-to-Text (STT) and Text-to-Speech (TTS)
- **Supabase** - Database, authentication, and Edge Functions
- **Windmill** - Workflow automation and task orchestration
- **GitHub** - Repository access and code management

**No OpenAI. No Gemini. Just FishAudio + Supabase + Windmill.**

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- A Supabase account (free tier works)
- FishAudio API key
- Windmill API key
- GitHub OAuth app

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd devspace-ai-co-pilot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # FishAudio API (REQUIRED)
   VITE_FISHAUDIO_API_KEY=your_fishaudio_api_key_here
   VITE_FISHAUDIO_DEFAULT_VOICE_ID=802e3bc2b27e49c2995d23ef70e6ac89

   # Supabase (REQUIRED)
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key_here

   # Windmill (REQUIRED)
   VITE_WINDMILL_API_KEY=your_windmill_api_key_here
   VITE_WINDMILL_BASE_URL=https://app.windmill.dev/api

   # GitHub OAuth (REQUIRED)
   VITE_GITHUB_CLIENT_ID=your_github_client_id_here
   VITE_GITHUB_CLIENT_SECRET=your_github_client_secret_here

   # Optional: LLM Configuration
   VITE_SUPABASE_LLM_FUNCTION=generate-text
   VITE_LLM_MODEL=meta-llama/llama-3-8b-instruct
   VITE_LLM_TEMPERATURE=0.7
   VITE_LLM_MAX_TOKENS=2048
   ```

4. **Set up Supabase**
   
   - Create a new project at [supabase.com](https://supabase.com)
   - Run the migration SQL in `SUPER_MIGRATION.sql` in your Supabase SQL Editor
   - Copy your project URL and anon key to `.env`

5. **Set up Supabase Edge Function (for LLM)**
   
   Create an Edge Function named `generate-text` that calls your preferred LLM API:
   ```typescript
   // supabase/functions/generate-text/index.ts
   import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

   serve(async (req) => {
     const { messages, systemPrompt, model, temperature, maxTokens } = await req.json()
     
     // Call your LLM API (OpenRouter, Together AI, etc.)
     const response = await fetch('https://api.openrouter.ai/api/v1/chat/completions', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${Deno.env.get('OPENROUTER_API_KEY')}`,
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({
         model: model || 'meta-llama/llama-3-8b-instruct',
         messages: [
           ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
           ...messages.map(m => ({ role: m.role, content: m.content }))
         ],
         temperature: temperature || 0.7,
         max_tokens: maxTokens || 2048,
       }),
     })
     
     const data = await response.json()
     return new Response(JSON.stringify({ text: data.choices[0].message.content }), {
       headers: { 'Content-Type': 'application/json' },
     })
   })
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. **Visit the application**
   ```
   http://localhost:8080
   ```

## 📋 API Keys Setup

### FishAudio

1. Go to [fish.audio](https://fish.audio)
2. Sign up for an account
3. Get your API key from the dashboard
4. Add to `.env` as `VITE_FISHAUDIO_API_KEY`

### Supabase

1. Go to [app.supabase.com](https://app.supabase.com)
2. Create a new project
3. Go to Settings → API
4. Copy Project URL → `VITE_SUPABASE_URL`
5. Copy anon/public key → `VITE_SUPABASE_PUBLISHABLE_KEY`

### Windmill

1. Go to [app.windmill.dev](https://app.windmill.dev)
2. Sign up for an account
3. Go to Settings → API Keys
4. Create a new API key
5. Add to `.env` as `VITE_WINDMILL_API_KEY`

### GitHub OAuth

1. Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set Authorization callback URL to: `http://localhost:8080/auth/github/callback`
4. Copy Client ID → `VITE_GITHUB_CLIENT_ID`
5. Copy Client Secret → `VITE_GITHUB_CLIENT_SECRET`

## 🎯 Usage

### 1. Authenticate with GitHub

- Click "Sign in with GitHub" on the home page
- Authorize the application
- You'll be redirected to the dashboard

### 2. Create AI Engineers

- Go to the "Engineers" tab
- Click "Add Engineer"
- Fill in:
  - Name
  - Personality description
  - Specialty (backend, frontend, fullstack, etc.)
  - Avatar URL (Ready Player Me)
  - Voice ID (FishAudio)

### 3. Connect GitHub Repository

- Go to the "Connections" tab
- Select your repository
- Set the base branch (default: main)
- Click "Save Connection"

### 4. Start a Video Call

- Go to the "Chat" tab
- Click "Start Video Call"
- Select which engineers to include
- Speak naturally - your voice is transcribed using FishAudio STT
- AI engineers respond with voice using FishAudio TTS

### 5. Assign Tasks

- During a call, ask an engineer to work on something
- Example: "Alex, create a new API endpoint"
- The engineer will:
  1. Acknowledge the task
  2. Leave the call
  3. Work on the task in the background
  4. Return when complete

## 🏗️ Project Structure

```
devspace-ai-co-pilot/
├── src/
│   ├── lib/
│   │   ├── fishaudio-service.ts    # FishAudio STT/TTS service
│   │   ├── windmill-service.ts     # Windmill workflow service
│   │   ├── llm-service.ts          # LLM via Supabase Edge Functions
│   │   ├── multi-agent-manager.ts  # Multi-agent coordination
│   │   └── ...
│   ├── components/
│   │   └── dashboard/
│   │       ├── ChatTab.tsx         # Voice chat interface
│   │       ├── EngineersTab.tsx    # Engineer management
│   │       ├── TasksTab.tsx        # Task tracking
│   │       └── ConnectionsTab.tsx  # GitHub connections
│   └── ...
├── supabase/
│   └── migrations/                 # Database migrations
└── .env                            # Environment variables
```

## 🔧 Development

### Running Locally

```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## 🐛 Troubleshooting

### FishAudio not working

- Verify `VITE_FISHAUDIO_API_KEY` is set correctly
- Check browser console for API errors
- Ensure microphone permissions are granted

### Supabase connection issues

- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are correct
- Check Supabase project is active (not paused)
- Verify RLS policies are set up correctly

### Windmill workflows not running

- Verify `VITE_WINDMILL_API_KEY` is set correctly
- Check Windmill dashboard for workflow status
- Ensure workflow IDs/paths are correct

## 📝 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- [FishAudio](https://fish.audio) - Voice AI services
- [Supabase](https://supabase.com) - Backend infrastructure
- [Windmill](https://windmill.dev) - Workflow automation
- [Ready Player Me](https://readyplayer.me) - 3D avatars

---

**Built for Hackathons. Production Ready. 🚀**
