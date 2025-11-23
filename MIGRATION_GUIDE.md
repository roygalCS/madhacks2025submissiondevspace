# Migration Guide: Removing Gemini/OpenAI

This guide helps you complete the migration to FishAudio-only architecture.

## Files to Remove

The following files contain Gemini/OpenAI code and should be removed:

```bash
# Remove Gemini files
rm src/lib/gemini-live.ts
rm src/lib/gemini-llm.ts

# Remove OpenAI files
rm src/lib/openai-realtime.ts
rm src/lib/openai-tts.ts
rm vite-plugin-realtime-proxy.ts
rm server/realtime-proxy.js
```

## Files to Update

### 1. `src/lib/multi-agent-manager.ts`

**Replace:**
- `import { GeminiLive } from './gemini-live'` 
- `import { generateWithGemini, generateWithGeminiStream } from './gemini-llm'`
- All `GeminiLive` references
- All `generateWithGemini` calls

**With:**
- `import { FishAudioTTS } from './fishaudio-service'`
- `import { LLMService } from './llm-service'`
- Use `FishAudioTTS` for TTS
- Use `LLMService` for text generation

### 2. `src/components/dashboard/ChatTab.tsx`

**Replace:**
- `GeminiLive` imports and usage
- `OpenAIRealtime` imports and usage

**With:**
- `import { FishAudioSTT, FishAudioTTS } from '@/lib/fishaudio-service'`
- Use `FishAudioSTT` for speech-to-text
- Use `FishAudioTTS` for text-to-speech

### 3. Update All Imports

Search for and replace:
- `gemini-live` → `fishaudio-service`
- `gemini-llm` → `llm-service`
- `openai-realtime` → `fishaudio-service`
- `openai-tts` → `fishaudio-service`

## Environment Variables

Update your `.env` file to remove:
- `VITE_OPENAI_API_KEY`
- `VITE_OPENAI_MODEL`
- `VITE_GEMINI_API_KEY`
- `VITE_GEMINI_VOICE`

And ensure you have:
- `VITE_FISHAUDIO_API_KEY` ✅
- `VITE_SUPABASE_URL` ✅
- `VITE_SUPABASE_PUBLISHABLE_KEY` ✅
- `VITE_WINDMILL_API_KEY` ✅

## Testing Checklist

After migration, verify:

- [ ] Voice recording works (FishAudio STT)
- [ ] AI responses are spoken (FishAudio TTS)
- [ ] Multi-agent calls function correctly
- [ ] Tasks are created and tracked
- [ ] GitHub connections work
- [ ] Supabase data persists
- [ ] Windmill workflows can be triggered

## Need Help?

If you encounter issues:

1. Check browser console for errors
2. Verify all API keys are set correctly
3. Ensure Supabase Edge Function is deployed
4. Check FishAudio API status

---

**The new architecture is cleaner, more maintainable, and hackathon-ready! 🚀**

