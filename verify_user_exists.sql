-- Verify user exists in auth.users table
-- Run this to check if your user exists

-- Check current authenticated user
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  confirmed_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- If you see your user, note the id
-- If you don't see your user, you may need to:
-- 1. Verify your email
-- 2. Sign up again
-- 3. Check authentication settings

