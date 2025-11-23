# FishAudio API Key Setup

## Your API Key

Your FishAudio API key is: `0a811ec793034edca2233e3f62ed9f0a`

## How to Add It

Add this to your `.env` file in the project root:

```env
VITE_FISHAUDIO_API_KEY=0a811ec793034edca2233e3f62ed9f0a
```

## Important Notes

- ✅ **Never commit `.env` to git** (it's already in `.gitignore`)
- ✅ **Restart dev server** after adding/changing `.env`
- ✅ This key is used for:
  - Speech-to-Text (STT) - converting your voice to text
  - Text-to-Speech (TTS) - converting AI responses to speech

## Verify It's Working

1. Add the key to `.env`
2. Restart: `npm run dev`
3. Go to Chat tab
4. Click microphone - should work without 500 errors
5. Check Connection Status in header - should show "FishAudio Key Ready"

## If You Get 500 Errors

- Verify the key is correct in `.env`
- Check the key is active at https://fish.audio
- Make sure you restarted the dev server after adding it

