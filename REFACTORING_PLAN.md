# Complete Refactoring Plan: FishAudio + Supabase + Windmill Only

## Overview
This document outlines the complete refactoring to remove ALL Gemini and OpenAI dependencies and use ONLY:
- **FishAudio** for STT and TTS
- **Supabase** for database and LLM (via Edge Functions)
- **Windmill** for workflow automation

## Files to Delete
✅ `src/lib/gemini-live.ts` - DELETED
✅ `src/lib/gemini-llm.ts` - DELETED
✅ `src/lib/openai-realtime.ts` - DELETED
✅ `src/lib/openai-tts.ts` - DELETED

## Files to Update

### 1. `src/lib/multi-agent-manager.ts`
**Changes:**
- Remove `import { GeminiLive } from './gemini-live'`
- Remove `import { generateWithGemini, generateWithGeminiStream } from './gemini-llm'`
- Add `import { LLMService } from './llm-service'`
- Add `import { FishAudioTTS } from './fishaudio-service'`
- Replace `geminiLive?: GeminiLive` with `fishAudioTTS?: FishAudioTTS`
- Replace all `generateWithGemini` calls with `LLMService.generate`
- Replace all `generateWithGeminiStream` calls with `LLMService.generateStream`
- Replace all `geminiLive.speakText()` calls with `fishAudioTTS.speak()`
- Remove `gemini_voice` references, use `fish_voice_id` instead

### 2. `src/components/dashboard/ChatTab.tsx`
**Changes:**
- Remove `import { GeminiLive } from "@/lib/gemini-live"`
- Add `import { FishAudioSTT, FishAudioTTS } from "@/lib/fishaudio-service"`
- Add `import { LLMService } from "@/lib/llm-service"`
- Replace `geminiLiveRef` with `fishAudioSTTRef` and `fishAudioTTSRef`
- Replace all Gemini Live initialization with FishAudio STT/TTS
- Replace `sendToGemini` function with `sendToLLM` using LLMService
- Update all voice call logic to use FishAudio

### 3. `src/lib/mvp-avatars.ts`
**Changes:**
- Remove `import type { GeminiVoice } from './gemini-live'`
- Remove `gemini_voice` from avatar definitions
- Keep only `fish_voice_id` references

### 4. `src/components/ConnectionStatus.tsx`
**Changes:**
- Remove OpenAI key check
- Add Supabase connection check

### 5. Environment Variables
**Create `.env.example` with:**
- VITE_FISHAUDIO_API_KEY
- VITE_FISHAUDIO_DEFAULT_VOICE_ID
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- VITE_SUPABASE_LLM_FUNCTION
- VITE_WINDMILL_API_KEY
- VITE_WINDMILL_BASE_URL
- VITE_GITHUB_CLIENT_ID
- VITE_GITHUB_CLIENT_SECRET
- VITE_LLM_MODEL (optional)
- VITE_LLM_TEMPERATURE (optional)
- VITE_LLM_MAX_TOKENS (optional)

## Implementation Status

- [x] Delete Gemini/OpenAI files
- [ ] Update multi-agent-manager.ts
- [ ] Update ChatTab.tsx
- [ ] Update mvp-avatars.ts
- [ ] Update ConnectionStatus.tsx
- [ ] Create .env.example
- [ ] Test all functionality
- [ ] Update README.md

## Testing Checklist

- [ ] FishAudio STT works (voice recording → transcription)
- [ ] FishAudio TTS works (text → speech)
- [ ] Supabase LLM service works (text generation)
- [ ] Multi-agent system works with new services
- [ ] Video calls work with FishAudio
- [ ] Windmill workflows can be triggered
- [ ] GitHub integration still works
- [ ] All UI components render correctly

