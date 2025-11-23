# Troubleshooting CORS/Network Errors with Supabase

If you're seeing errors like:
- "Fetch API cannot load ... due to access control checks"
- "The network connection was lost"
- "TypeError: Load failed"

## Quick Fixes:

### 1. Check Supabase Project Status
- Go to your [Supabase Dashboard](https://app.supabase.com)
- Make sure your project is **not paused**
- Paused projects won't accept connections

### 2. Verify Environment Variables
Check your `.env` file has the correct values:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
```

**Important:** 
- The URL should end with `.supabase.co` (not `.supabase.io`)
- Make sure there are no extra spaces or quotes
- Restart your dev server after changing `.env`

### 3. Check CORS Settings
Supabase should handle CORS automatically, but verify:
1. Go to Supabase Dashboard → Settings → API
2. Make sure "Enable CORS" is checked (it should be by default)
3. Your localhost URL should be allowed (usually automatic for localhost)

### 4. Verify Authentication
- Make sure you're logged in to the app
- Check browser console for auth errors
- Try logging out and back in

### 5. Network/Firewall Issues
- Check if you're behind a corporate firewall
- Try a different network (mobile hotspot)
- Check if antivirus is blocking requests

### 6. Check Browser Console
Open browser DevTools (F12) and check:
- Network tab: Are requests failing?
- Console tab: Any specific error messages?
- Application tab → Local Storage: Is there a Supabase session?

## Testing Connection

You can test your Supabase connection directly:

```bash
# Test if your Supabase URL is reachable
curl -I https://your-project.supabase.co/rest/v1/

# Should return 200 or 401 (not 404 or connection error)
```

## Common Issues:

### Issue: "Project not found" or 404
**Solution:** Your Supabase URL is wrong. Get the correct URL from:
- Supabase Dashboard → Settings → API → Project URL

### Issue: "Invalid API key"
**Solution:** Your publishable key is wrong. Get it from:
- Supabase Dashboard → Settings → API → Project API keys → `anon` `public`

### Issue: Intermittent connection failures
**Solution:** 
- Check your internet connection
- Supabase might be experiencing issues (check status page)
- Try again in a few minutes

### Issue: Works in production but not localhost
**Solution:**
- Make sure your `.env` file is in the project root
- Restart your dev server after changing `.env`
- Clear browser cache and localStorage

## Still Having Issues?

1. Check Supabase status: https://status.supabase.com
2. Verify your project is active in Supabase dashboard
3. Check the exact error in browser console
4. Try creating a new Supabase project to test

