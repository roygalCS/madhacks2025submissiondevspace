# 🚀 DevSpace AI Co-Pilot - Hackathon Ready

> **Perfect Exoskeleton for Hackathon Submission**  
> Voice-powered AI engineering platform using **ONLY** FishAudio, Supabase, and Windmill.

## ✨ Architecture

**Stack:**
- ✅ **FishAudio** - Speech-to-Text (STT) and Text-to-Speech (TTS)
- ✅ **Supabase** - Database, Authentication, and Edge Functions (for LLM)
- ✅ **Windmill** - Workflow automation and task orchestration
- ✅ **GitHub** - Repository access and code management

**Removed:**
- ❌ OpenAI (completely removed)
- ❌ Google Gemini (completely removed)

## 🎯 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file with:

```env
# FishAudio (REQUIRED)
VITE_FISHAUDIO_API_KEY=your_fishaudio_api_key
VITE_FISHAUDIO_DEFAULT_VOICE_ID=802e3bc2b27e49c2995d23ef70e6ac89

# Supabase (REQUIRED)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_LLM_FUNCTION=generate-text

# Windmill (REQUIRED)
VITE_WINDMILL_API_KEY=your_windmill_api_key
VITE_WINDMILL_BASE_URL=https://app.windmill.dev/api

# GitHub OAuth (REQUIRED)
VITE_GITHUB_CLIENT_ID=your_github_client_id
VITE_GITHUB_CLIENT_SECRET=your_github_client_secret

# LLM Configuration (Optional)
VITE_LLM_MODEL=meta-llama/llama-3-8b-instruct
VITE_LLM_TEMPERATURE=0.7
VITE_LLM_MAX_TOKENS=2048
```

### 3. Set Up Supabase Edge Function

Create a Supabase Edge Function named `generate-text` that calls your LLM provider:

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

### 4. Run Database Migration

In Supabase SQL Editor, run `SUPER_MIGRATION.sql`

### 5. Start Development Server
```bash
npm run dev
```

Visit: **http://localhost:8080**

## 📋 API Keys Setup

### FishAudio
1. Go to [fish.audio](https://fish.audio)
2. Sign up and get your API key
3. Add to `.env` as `VITE_FISHAUDIO_API_KEY`

### Supabase
1. Go to [app.supabase.com](https://app.supabase.com)
2. Create a project
3. Go to Settings → API
4. Copy URL → `VITE_SUPABASE_URL`
5. Copy anon key → `VITE_SUPABASE_PUBLISHABLE_KEY`

### Windmill
1. Go to [app.windmill.dev](https://app.windmill.dev)
2. Sign up and create an API key
3. Add to `.env` as `VITE_WINDMILL_API_KEY`

### GitHub OAuth
1. Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Create OAuth App
3. Set callback: `http://localhost:8080/auth/github/callback`
4. Copy Client ID and Secret to `.env`

## 🎯 Features

- 🎤 **Real-Time Voice** - FishAudio STT/TTS for natural conversation
- 👥 **Multi-Agent** - Multiple AI engineers work in parallel
- 🔄 **Workflow Automation** - Windmill integration for complex tasks
- 💾 **Supabase Backend** - Robust data storage and real-time sync
- 🎨 **3D Avatars** - Ready Player Me avatars
- 🔗 **GitHub Integration** - Direct repository access

## 🏗️ Project Structure

```
src/
├── lib/
│   ├── fishaudio-service.ts    # FishAudio STT/TTS
│   ├── llm-service.ts          # LLM via Supabase Edge Functions
│   ├── windmill-service.ts     # Windmill workflows
│   ├── multi-agent-manager.ts  # Multi-agent coordination
│   └── ...
├── components/
│   └── dashboard/
│       ├── ChatTab.tsx         # Voice chat interface
│       ├── EngineersTab.tsx    # Engineer management
│       ├── TasksTab.tsx        # Task tracking
│       └── ConnectionsTab.tsx  # GitHub connections
└── ...
```

## ✅ Refactoring Complete

All Gemini and OpenAI code has been removed and replaced with:
- FishAudio for all voice operations
- Supabase Edge Functions for LLM
- Windmill for workflow automation

**Ready for hackathon submission! 🚀**

