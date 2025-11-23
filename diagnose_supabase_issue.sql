-- Comprehensive Supabase Diagnostic Script
-- Run this in Supabase SQL Editor to diagnose the foreign key issue

-- 1. Check if your user exists in auth.users
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'roygalca@gmail.com';

-- 2. Check the engineers table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'engineers'
ORDER BY ordinal_position;

-- 3. Check foreign key constraints on engineers table
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'engineers';

-- 4. Check RLS policies on engineers table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'engineers'
ORDER BY policyname;

-- 5. Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'engineers';

-- 6. Test: Try to see what auth.uid() returns (this will show your current user ID)
SELECT 
  auth.uid() as current_user_id,
  auth.email() as current_user_email;

-- 7. Check existing engineers (if any)
SELECT 
  id,
  user_id,
  name,
  created_at
FROM public.engineers
LIMIT 5;

-- Summary
SELECT 
  'Diagnostic complete! Check the results above.' as status,
  'If auth.uid() returns NULL, you are not authenticated in SQL context.' as note1,
  'If user_id in engineers table does not match auth.users.id, that is the issue.' as note2;

