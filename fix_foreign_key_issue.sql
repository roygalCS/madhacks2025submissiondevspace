-- Fix foreign key constraint issue for engineers table
-- This script will help resolve the "Key is not present in table users" error

-- Step 1: Check current foreign key constraint
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'engineers'
  AND kcu.column_name = 'user_id';

-- Step 2: Drop the existing foreign key constraint (if it exists)
ALTER TABLE public.engineers 
DROP CONSTRAINT IF EXISTS engineers_user_id_fkey;

-- Step 3: Recreate the foreign key constraint with proper configuration
ALTER TABLE public.engineers
ADD CONSTRAINT engineers_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Step 4: Verify the constraint was created
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'engineers'
  AND kcu.column_name = 'user_id';

-- Step 5: Verify your user exists (should return your user)
SELECT 
  id,
  email,
  email_confirmed_at
FROM auth.users
WHERE email = 'roygalca@gmail.com';

-- Success message
SELECT 'Foreign key constraint has been recreated. Try creating an engineer in your app now!' as status;

