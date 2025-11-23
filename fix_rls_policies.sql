-- Fix RLS policies for engineers table
-- Run this in Supabase SQL Editor

-- First, drop all existing policies on engineers table
DROP POLICY IF EXISTS "Users can view their own engineers" ON public.engineers;
DROP POLICY IF EXISTS "Users can create their own engineers" ON public.engineers;
DROP POLICY IF EXISTS "Users can update their own engineers" ON public.engineers;
DROP POLICY IF EXISTS "Users can delete their own engineers" ON public.engineers;

-- Ensure RLS is enabled
ALTER TABLE public.engineers ENABLE ROW LEVEL SECURITY;

-- Recreate policies with proper syntax
CREATE POLICY "Users can view their own engineers"
  ON public.engineers
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own engineers"
  ON public.engineers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own engineers"
  ON public.engineers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own engineers"
  ON public.engineers
  FOR DELETE
  USING (auth.uid() = user_id);

-- Verify policies were created
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
WHERE schemaname = 'public' AND tablename = 'engineers'
ORDER BY policyname;

-- Success message
SELECT 'RLS policies for engineers table have been recreated!' as status;

