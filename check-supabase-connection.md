# 🔍 Supabase Connection Troubleshooting

If you're seeing "Load failed" or connection errors, follow these steps:

## Step 1: Check Environment Variables

1. Make sure you have a `.env` file in the project root
2. Verify it contains:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
   ```

3. **Get your values from Supabase:**
   - Go to https://app.supabase.com
   - Select your project
   - Go to Settings → API
   - Copy:
     - **Project URL** → `VITE_SUPABASE_URL`
     - **anon public** key → `VITE_SUPABASE_PUBLISHABLE_KEY`

## Step 2: Restart Dev Server

After updating `.env`, you **MUST** restart your dev server:

```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

**Important:** Vite only reads `.env` on startup. Changes won't take effect until you restart.

## Step 3: Check Supabase Project Status

1. Go to https://app.supabase.com
2. Check if your project is **active** (not paused)
3. Free tier projects pause after inactivity - click "Restore" if needed

## Step 4: Check CORS Settings

**Important:** Supabase allows localhost by default, but let's verify:

1. In Supabase Dashboard → Settings → API
2. Scroll down to "CORS Configuration"
3. By default, Supabase allows:
   - `http://localhost:*` (all ports)
   - `http://127.0.0.1:*` (all ports)
4. If you see a restricted list, make sure your port is included:
   - `http://localhost:8080` (your current port)
   - `http://localhost:5173` (default Vite port)

**Note:** If CORS is the issue, you'll see errors in browser console Network tab showing blocked requests.

## Step 5: Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for CORS errors or network errors
4. Check Network tab for failed requests to Supabase

## Step 6: Verify Environment Variables Are Loaded

Open browser console and check:
```javascript
console.log(import.meta.env.VITE_SUPABASE_URL)
console.log(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
```

If these are `undefined`, your `.env` file isn't being loaded.

## Step 7: Check Browser Network Tab

1. Open DevTools (F12) → Network tab
2. Try loading the Engineers tab again
3. Look for requests to `*.supabase.co`
4. Check if they show:
   - **Red/blocked** = CORS issue
   - **404** = Wrong URL
   - **401/403** = Auth issue
   - **500** = Server error

## Step 8: Test Direct Connection

Open browser console and run:
```javascript
// Replace with your actual values from .env
const url = 'YOUR_SUPABASE_URL';
const key = 'YOUR_SUPABASE_KEY';

fetch(`${url}/rest/v1/`, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
  },
})
.then(r => console.log('✅ Connection OK:', r.status))
.catch(e => console.error('❌ Connection failed:', e));
```

If this fails, it's a network/CORS issue. If it succeeds, the problem is with the Supabase client configuration.

## Common Issues

### Issue: "Load failed" error
**Solution:** Usually means:
- Missing or incorrect environment variables
- Supabase project is paused
- CORS not configured
- Network connectivity issue

### Issue: Variables show as undefined
**Solution:**
1. Make sure `.env` is in project root (same folder as `package.json`)
2. Restart dev server after creating/editing `.env`
3. Check for typos in variable names (must start with `VITE_`)

### Issue: CORS errors in console
**Solution:**
1. Add your localhost URL to Supabase CORS settings
2. Or use Supabase's default CORS (allows localhost by default)

## Quick Test

Run this in browser console when app is loaded:
```javascript
// Should show your Supabase URL (not undefined)
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);

// Should show 'SET' (not undefined)
console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? 'SET' : 'MISSING');
```

If either shows undefined, your `.env` file isn't being loaded properly.

