# 🔧 Force LocalStorage Mode

If Supabase is down or you want to use localStorage instead, you can force it:

## Quick Fix (Browser Console)

Open browser console (F12) and run:

```javascript
localStorage.setItem('devspace-use-localstorage', 'true');
location.reload();
```

This will:
- ✅ Switch to localStorage mode immediately
- ✅ Store data in your browser (no Supabase needed)
- ✅ Work offline for database operations
- ✅ Persist across page refreshes

## Remove Supabase Env Vars (Alternative)

Or simply remove/comment out Supabase vars in `.env`:

```env
# VITE_SUPABASE_URL=
# VITE_SUPABASE_PUBLISHABLE_KEY=
```

Then restart the dev server.

## Switch Back to Supabase

To switch back to Supabase:

```javascript
localStorage.removeItem('devspace-use-localstorage');
location.reload();
```

And make sure your `.env` has valid Supabase credentials.

