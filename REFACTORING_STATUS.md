# Refactoring Status: FishAudio + Supabase + Windmill Only

## ✅ Completed

1. **Deleted Gemini/OpenAI files:**
   - ✅ `src/lib/gemini-live.ts` - DELETED
   - ✅ `src/lib/gemini-llm.ts` - DELETED
   - ✅ `src/lib/openai-realtime.ts` - DELETED
   - ✅ `src/lib/openai-tts.ts` - DELETED

2. **Updated `src/lib/multi-agent-manager.ts`:**
   - ✅ Removed Gemini imports
   - ✅ Added LLMService and FishAudioTTS imports
   - ✅ Replaced `geminiLive` with `fishAudioTTS`
   - ✅ Replaced all `generateWithGemini` calls with `LLMService.generate`
   - ✅ Replaced all `generateWithGeminiStream` calls with `LLMService.generateStream`
   - ✅ Updated TTS to use FishAudio instead of Gemini Live
   - ✅ Updated constructor to accept FishAudioTTS and LLMService
   - ✅ All Gemini references removed

3. **Created `.env.example`:**
   - ✅ All required API keys documented
   - ✅ FishAudio, Supabase, Windmill, GitHub configs

## 🔄 In Progress / TODO

1. **Update `src/components/dashboard/ChatTab.tsx`** (73 Gemini/OpenAI references)
   - [ ] Remove `import { GeminiLive }`
   - [ ] Add `import { FishAudioSTT, FishAudioTTS }`
   - [ ] Add `import { LLMService }`
   - [ ] Replace `geminiLiveRef` with `fishAudioSTTRef` and `fishAudioTTSRef`
   - [ ] Replace `sendToGemini` with `sendToLLM` using LLMService
   - [ ] Update video call initialization
   - [ ] Update all voice interaction logic

2. **Update `src/lib/mvp-avatars.ts`:**
   - [ ] Remove `GeminiVoice` type import
   - [ ] Remove `gemini_voice` from avatar definitions

3. **Update `src/components/ConnectionStatus.tsx`:**
   - [ ] Remove OpenAI key check
   - [ ] Add Supabase connection check

4. **Update README.md:**
   - [ ] Reflect new architecture (FishAudio + Supabase + Windmill only)
   - [ ] Update setup instructions

## 📋 Next Steps

The core `multi-agent-manager.ts` is complete. The main remaining work is in `ChatTab.tsx` which needs:
- Replace GeminiLive with FishAudio STT/TTS
- Replace Gemini LLM calls with LLMService
- Update initialization code

This is a large file (~2200 lines) with 73 references to update. The pattern is:
1. Replace `GeminiLive` with `FishAudioSTT`/`FishAudioTTS`
2. Replace `sendToGemini` with `sendToLLM` using `LLMService`
3. Update all voice call setup code

## 🎯 Architecture

**New Stack:**
- **FishAudio** - STT and TTS (voice)
- **Supabase** - Database + Edge Functions (LLM via Edge Functions)
- **Windmill** - Workflow automation
- **GitHub** - Repository access

**No OpenAI. No Gemini. Just FishAudio + Supabase + Windmill.**

