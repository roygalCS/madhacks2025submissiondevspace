# 🚀 Quick Start - Get Running in 5 Minutes

## Step 1: Install Dependencies
```bash
npm install
```

## Step 2: Create `.env` File
Create a `.env` file in the root directory with:

```env
# REQUIRED - Get from https://app.supabase.com → Settings → API
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# REQUIRED - Get from https://fish.audio
VITE_FISHAUDIO_API_KEY=your-key

# REQUIRED - Get from https://openrouter.ai
VITE_OPENROUTER_API_KEY=your-key
```

## Step 3: Run Database Migration
1. Go to https://app.supabase.com
2. Open your project → SQL Editor
3. Copy and run: `SUPER_MIGRATION.sql` (from project root)

This single migration sets up everything perfectly - tables, columns, foreign keys, and RLS policies.

## Step 4: Start the App
```bash
npm run dev
```

Visit: **http://localhost:8080**

## Step 5: Sign Up & Test
1. Create an account
2. Go to Chat tab
3. Click "Start Video Call"
4. Allow camera/mic permissions
5. See your 4 AI engineers! 🎉

---

## 🎯 That's It!

You're ready to demo. See `DEMO_GUIDE.md` for presentation tips.

## 🆘 Issues?

- **App won't start?** Check `.env` file exists and has all variables
- **Can't connect to Supabase?** Verify project is active (not paused)
- **Video call not working?** Check browser permissions
- **Avatars not loading?** Check browser console for errors

See `SETUP.md` for detailed troubleshooting.

