# 🔧 Fix 401 Unauthorized Error

You're getting a **401 Unauthorized** error, which means:
- ✅ Your Supabase URL is correct (we can reach it)
- ❌ Your API key is incorrect or missing

## Quick Fix

### Step 1: Get Your Correct API Key

1. Go to https://app.supabase.com
2. Select your project
3. Go to **Settings** → **API**
4. Scroll to **Project API keys** section
5. Find the **`anon` `public`** key:
   - It's a **very long** JWT token (100+ characters)
   - Starts with `eyJ...` (not `sb_publishable_...`)
   - Labeled as "anon" and "public"
   - **NOT** the "publishable" key
   - **NOT** the "service_role" key
6. Click the copy button to copy the ENTIRE key

### Step 2: Update Your .env File

Open your `.env` file and update:

```env
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important:**
- The key should start with `eyJ` (it's a JWT token)
- Make sure there are no quotes around it
- No spaces before or after the `=`
- Use the `anon` `public` key, NOT `service_role`

### Step 3: Restart Dev Server

```bash
# Stop server (Ctrl+C)
npm run dev
```

### Step 4: Verify

After restarting, the error should be gone. If you still see 401:
- Double-check you copied the entire key (they're long!)
- Make sure you're using the `anon` key, not `service_role`
- Check for any extra spaces or quotes in `.env`

## Common Mistakes

❌ **Wrong:** Using `service_role` key (this is secret, don't use in frontend)
✅ **Right:** Using `anon` `public` key

❌ **Wrong:** `VITE_SUPABASE_PUBLISHABLE_KEY="eyJ..."` (quotes)
✅ **Right:** `VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...` (no quotes)

❌ **Wrong:** Key with spaces or line breaks
✅ **Right:** Single line, no spaces

## Still Not Working?

1. Check browser console - does it show the key is loaded?
   ```javascript
   console.log(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
   ```

2. Verify key format - should be a long JWT starting with `eyJ`

3. Try creating a new Supabase project to get fresh keys

