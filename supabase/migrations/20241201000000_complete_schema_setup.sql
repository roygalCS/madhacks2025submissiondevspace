-- ============================================
-- COMPLETE SCHEMA SETUP - DevSpace AI Co-Pilot
-- ============================================
-- This migration ensures the database is in the exact expected state
-- Safe to run multiple times (idempotent)
-- Run this in Supabase Dashboard → SQL Editor

-- ============================================
-- STEP 1: ENGINEERS TABLE
-- ============================================

-- Drop existing table if you want a fresh start (COMMENTED OUT - uncomment only if you want to lose data)
-- DROP TABLE IF EXISTS public.engineers CASCADE;

-- Create engineers table with all required columns
CREATE TABLE IF NOT EXISTS public.engineers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  personality TEXT,
  avatar_url TEXT,  -- Ready Player Me URL
  fish_voice_id TEXT,
  specialty TEXT CHECK (specialty IN ('backend', 'frontend', 'fullstack', 'security', 'devops', 'mobile', 'ai/ml', 'general')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add columns that might be missing
DO $$ 
BEGIN
  -- Add avatar_url if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'engineers' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.engineers ADD COLUMN avatar_url TEXT;
  END IF;

  -- Add specialty if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'engineers' AND column_name = 'specialty'
  ) THEN
    ALTER TABLE public.engineers ADD COLUMN specialty TEXT;
    ALTER TABLE public.engineers ADD CONSTRAINT engineers_specialty_check 
      CHECK (specialty IS NULL OR specialty IN ('backend', 'frontend', 'fullstack', 'security', 'devops', 'mobile', 'ai/ml', 'general'));
  END IF;

  -- Remove old tavus_avatar_id if it exists (optional cleanup)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'engineers' AND column_name = 'tavus_avatar_id'
  ) THEN
    -- Migrate data first if needed
    UPDATE public.engineers
    SET avatar_url = CASE
      WHEN tavus_avatar_id IS NULL THEN avatar_url
      WHEN tavus_avatar_id LIKE 'http%' THEN tavus_avatar_id
      WHEN avatar_url IS NULL THEN 'https://models.readyplayer.me/' || tavus_avatar_id || '.glb'
      ELSE avatar_url
    END
    WHERE tavus_avatar_id IS NOT NULL AND avatar_url IS NULL;
    
    -- Now drop the old column
    ALTER TABLE public.engineers DROP COLUMN IF EXISTS tavus_avatar_id;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.engineers ENABLE ROW LEVEL SECURITY;

-- Drop and recreate RLS policies (ensures they're correct)
DROP POLICY IF EXISTS "Users can view their own engineers" ON public.engineers;
DROP POLICY IF EXISTS "Users can create their own engineers" ON public.engineers;
DROP POLICY IF EXISTS "Users can update their own engineers" ON public.engineers;
DROP POLICY IF EXISTS "Users can delete their own engineers" ON public.engineers;

CREATE POLICY "Users can view their own engineers"
  ON public.engineers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own engineers"
  ON public.engineers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own engineers"
  ON public.engineers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own engineers"
  ON public.engineers FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- STEP 2: TASKS TABLE
-- ============================================

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  engineer_id UUID REFERENCES public.engineers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed')),
  output TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Fix foreign key constraint to ensure ON DELETE SET NULL
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_engineer_id_fkey;
  
  -- Recreate with correct ON DELETE behavior
  ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_engineer_id_fkey
  FOREIGN KEY (engineer_id)
  REFERENCES public.engineers(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
END $$;

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Drop and recreate RLS policies
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;

CREATE POLICY "Users can view their own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- STEP 3: CONNECTIONS TABLE
-- ============================================

-- Create connections table
CREATE TABLE IF NOT EXISTS public.connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  github_token TEXT,
  github_username TEXT,
  github_repo_name TEXT,
  base_branch TEXT DEFAULT 'main',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add/update columns
DO $$
BEGIN
  -- Add base_branch if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'connections' AND column_name = 'base_branch'
  ) THEN
    ALTER TABLE public.connections ADD COLUMN base_branch TEXT DEFAULT 'main';
  END IF;

  -- Set default for existing rows
  UPDATE public.connections SET base_branch = 'main' WHERE base_branch IS NULL;

  -- Remove unused API key columns (optional cleanup - uncomment if you want to remove them)
  -- ALTER TABLE public.connections DROP COLUMN IF EXISTS cursor_api_key;
  -- ALTER TABLE public.connections DROP COLUMN IF EXISTS windmill_api_key;
  -- ALTER TABLE public.connections DROP COLUMN IF EXISTS tavus_api_key;
END $$;

-- Enable RLS
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- Drop and recreate RLS policies
DROP POLICY IF EXISTS "Users can view their own connections" ON public.connections;
DROP POLICY IF EXISTS "Users can create their own connections" ON public.connections;
DROP POLICY IF EXISTS "Users can update their own connections" ON public.connections;
DROP POLICY IF EXISTS "Users can delete their own connections" ON public.connections;

CREATE POLICY "Users can view their own connections"
  ON public.connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own connections"
  ON public.connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connections"
  ON public.connections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connections"
  ON public.connections FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- STEP 4: VERIFICATION
-- ============================================

-- Verify all tables exist
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('engineers', 'tasks', 'connections');
  
  IF table_count = 3 THEN
    RAISE NOTICE '✅ All tables created successfully';
  ELSE
    RAISE WARNING '⚠️ Expected 3 tables, found %', table_count;
  END IF;
END $$;

-- Show final schema
SELECT 
  'engineers' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'engineers'
ORDER BY ordinal_position

UNION ALL

SELECT 
  'tasks' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tasks'
ORDER BY ordinal_position

UNION ALL

SELECT 
  'connections' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'connections'
ORDER BY ordinal_position;

-- Success message
SELECT '✅ Database schema setup complete! All tables, columns, constraints, and RLS policies are configured correctly.' as status;

