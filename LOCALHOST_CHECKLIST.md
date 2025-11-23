# ✅ Localhost Setup Checklist

## Quick Verification

Run this to check your setup:
```bash
./verify-localhost.sh
```

Or manually check:

## ✅ Required Before Running

### 1. Dependencies Installed
```bash
npm install
```

### 2. Environment Variables (.env file)
Create `.env` in project root with:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_FISHAUDIO_API_KEY=your-key
VITE_OPENROUTER_API_KEY=your-key
```

### 3. Database Migration
- Go to Supabase Dashboard → SQL Editor
- Run: `supabase/migrations/20241123000000_replace_tavus_with_ready_player_me.sql`

### 4. Port Available
- Default port: **8080**
- If in use, change in `vite.config.ts`

---

## 🚀 Starting on Localhost

```bash
npm run dev
```

Visit: **http://localhost:8080**

---

## ✅ What Works on Localhost

### ✅ Fully Working:
- ✅ **Authentication** (Supabase)
- ✅ **Database** (Supabase)
- ✅ **Voice Recording** (Microphone access works on localhost)
- ✅ **STT/TTS** (FishAudio via proxy - no CORS issues)
- ✅ **AI Chat** (OpenRouter API)
- ✅ **3D Avatars** (Ready Player Me - loads from CDN)
- ✅ **Video Calls** (WebRTC - works on localhost)
- ✅ **GitHub Operations** (GitHub API)
- ✅ **Task Management** (Supabase)

### ⚠️ Browser Requirements:
- **Chrome/Edge recommended** (best WebRTC support)
- **Microphone/Camera permissions** (browser will prompt)
- **HTTPS not required** (localhost is secure context)

---

## 🐛 Common Localhost Issues

### Issue: "Microphone permission denied"
**Solution:**
- Check browser address bar for permission icon
- Go to browser settings → Privacy → Microphone
- Allow localhost:8080

### Issue: "Supabase connection failed"
**Solution:**
- Verify `.env` file has correct values
- Check Supabase project is active (not paused)
- Restart dev server after changing `.env`

### Issue: "Port 8080 already in use"
**Solution:**
```bash
# Find what's using port 8080
lsof -i :8080

# Kill it or change port in vite.config.ts
```

### Issue: "Avatars not loading"
**Solution:**
- Check browser console for CORS errors
- Verify avatar URLs in `.env` are valid
- Ready Player Me URLs should be accessible

### Issue: "API calls failing"
**Solution:**
- Check `.env` has all API keys
- Verify API keys are valid (not expired)
- Check browser Network tab for errors

---

## 🧪 Testing on Localhost

### Test 1: Basic App Load
1. Start: `npm run dev`
2. Visit: http://localhost:8080
3. Should see: Landing page

### Test 2: Authentication
1. Click "Sign Up" or go to `/auth`
2. Create account
3. Should redirect to `/dashboard`

### Test 3: Video Call
1. Go to Chat tab
2. Click "Start Video Call"
3. Allow camera/mic permissions
4. Should see: Your video + AI avatars

### Test 4: Voice Interaction
1. Click microphone button
2. Speak something
3. Should see: Transcript + AI response

### Test 5: GitHub Integration
1. Go to Connections tab
2. Add GitHub token, username, repo
3. Go to Chat, ask: "What files are in my repo?"
4. Should see: Engineer responds with file list

---

## ✅ Everything Should Work!

If all checks pass, **everything will work on localhost**. The app is designed to work fully in development mode.

**No special configuration needed** - just:
1. ✅ `.env` file with API keys
2. ✅ Database migration run
3. ✅ `npm run dev`

That's it! 🚀

