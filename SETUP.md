# DevSpace AI Co-Pilot - Complete Setup Guide

## 🚀 Quick Start (5 Minutes)

### 1. Prerequisites
- Node.js 18+ and npm
- A Supabase account (free tier works)
- API keys (see below)

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory:

```bash
# Supabase (Required)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key-here

# FishAudio API (Required for Voice)
VITE_FISHAUDIO_API_KEY=your_fishaudio_api_key_here

# OpenRouter API (Required for AI Chat)
VITE_OPENROUTER_API_KEY=your_openrouter_api_key_here

# Optional: Model (default: meta-llama/llama-3-8b-instruct)
VITE_OPENROUTER_MODEL=meta-llama/llama-3-8b-instruct

# Ready Player Me Avatars (Optional - defaults provided)
VITE_AVATAR_1_URL=https://models.readyplayer.me/69226336672cca15c2b4bb34.glb
VITE_AVATAR_2_URL=https://models.readyplayer.me/692264ba672cca15c2b4d588.glb
VITE_AVATAR_3_URL=https://models.readyplayer.me/692264ba672cca15c2b4d588.glb
VITE_AVATAR_4_URL=https://models.readyplayer.me/692264fcbcfe438b189c885c.glb
```

### 4. Run Database Migration
**RECOMMENDED: Run the Super Migration** (sets everything up perfectly):
```sql
# In Supabase Dashboard → SQL Editor, copy and run:
# SUPER_MIGRATION.sql (in project root)
```

This single migration ensures:
- ✅ All tables created correctly
- ✅ All columns present (avatar_url, specialty, base_branch, etc.)
- ✅ Foreign keys configured properly (ON DELETE SET NULL for tasks)
- ✅ RLS policies set up correctly
- ✅ Removes unused columns (tavus_avatar_id, etc.)

**Alternative:** Run individual migrations in order if you prefer incremental setup.

### 5. Start Development Server
```bash
npm run dev
```

The app will be available at: **http://localhost:8080**

---

## 📋 API Keys Setup

### Supabase (Free)
1. Go to https://app.supabase.com
2. Create a new project
3. Go to Settings → API
4. Copy:
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` `public` key → `VITE_SUPABASE_PUBLISHABLE_KEY`

### FishAudio (Free Tier Available)
1. Go to https://fish.audio
2. Sign up for free account
3. Get API key from dashboard
4. Add to `.env` as `VITE_FISHAUDIO_API_KEY`

### OpenRouter (Free Credits)
1. Go to https://openrouter.ai
2. Sign up (free credits available)
3. Create API key
4. Add to `.env` as `VITE_OPENROUTER_API_KEY`

### GitHub (Optional - for Code Operations)
1. Go to https://github.com/settings/tokens
2. Generate new token with `repo` scope
3. Add in Connections tab after logging in

---

## 🎯 Demo Checklist

Before demoing, ensure:

- [ ] All API keys are set in `.env`
- [ ] Supabase project is active (not paused)
- [ ] Database migrations are run
- [ ] You can sign up/login
- [ ] Video call works (camera/mic permissions)
- [ ] Engineers can be created
- [ ] GitHub connection is set (if demoing code operations)

---

## 🐛 Troubleshooting

### App won't start
- Check `.env` file exists and has all required variables
- Restart dev server after changing `.env`
- Check console for specific errors

### Supabase connection fails
- Verify project is not paused
- Check URL ends with `.supabase.co`
- Verify API key is correct
- See `TROUBLESHOOTING_CORS.md`

### Video call not working
- Allow camera/mic permissions in browser
- Check browser console for errors
- Try Chrome/Edge (best compatibility)

### Avatars not loading
- Check avatar URLs are valid
- Open browser console for errors
- Verify Three.js is installed

---

## 🎨 Features for Demo

1. **Real-time Video Calls**: Start a call to see 4 AI engineers
2. **Voice Interaction**: Click mic to talk, engineers respond
3. **GitHub Integration**: Engineers work on branches, push changes
4. **Task Management**: Assign tasks, track progress
5. **Multi-Agent**: 4 engineers work in parallel

---

## 📦 Production Build

```bash
npm run build
npm run preview
```

---

## 🆘 Need Help?

Check:
- `TROUBLESHOOTING_CORS.md` for Supabase issues
- Browser console for specific errors
- Network tab for API failures

