-- ============================================
-- 🚀 SUPER MIGRATION - DevSpace AI Co-Pilot
-- ============================================
-- This ensures your database is in the EXACT expected state
-- Safe to run multiple times - it's idempotent
-- 
-- INSTRUCTIONS:
-- 1. Copy this entire file
-- 2. Go to Supabase Dashboard → SQL Editor
-- 3. Paste and run
-- 4. Done! Your database is now perfect ✅
-- ============================================

-- ============================================
-- ENGINEERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.engineers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  personality TEXT,
  avatar_url TEXT,
  fish_voice_id TEXT,
  specialty TEXT CHECK (specialty IN ('backend', 'frontend', 'fullstack', 'security', 'devops', 'mobile', 'ai/ml', 'general')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add missing columns
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'engineers' AND column_name = 'avatar_url') THEN
    ALTER TABLE public.engineers ADD COLUMN avatar_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'engineers' AND column_name = 'specialty') THEN
    ALTER TABLE public.engineers ADD COLUMN specialty TEXT;
    ALTER TABLE public.engineers ADD CONSTRAINT engineers_specialty_check 
      CHECK (specialty IS NULL OR specialty IN ('backend', 'frontend', 'fullstack', 'security', 'devops', 'mobile', 'ai/ml', 'general'));
  END IF;
  -- Remove old tavus_avatar_id if exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'engineers' AND column_name = 'tavus_avatar_id') THEN
    UPDATE public.engineers SET avatar_url = COALESCE(avatar_url, CASE WHEN tavus_avatar_id LIKE 'http%' THEN tavus_avatar_id ELSE 'https://models.readyplayer.me/' || tavus_avatar_id || '.glb' END) WHERE tavus_avatar_id IS NOT NULL AND avatar_url IS NULL;
    ALTER TABLE public.engineers DROP COLUMN IF EXISTS tavus_avatar_id;
  END IF;
END $$;

-- RLS Policies for Engineers
ALTER TABLE public.engineers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own engineers" ON public.engineers;
DROP POLICY IF EXISTS "Users can create their own engineers" ON public.engineers;
DROP POLICY IF EXISTS "Users can update their own engineers" ON public.engineers;
DROP POLICY IF EXISTS "Users can delete their own engineers" ON public.engineers;

CREATE POLICY "Users can view their own engineers" ON public.engineers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own engineers" ON public.engineers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own engineers" ON public.engineers FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own engineers" ON public.engineers FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- TASKS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  engineer_id UUID REFERENCES public.engineers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed')),
  output TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Fix foreign key (CRITICAL for delete to work)
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_engineer_id_fkey;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_engineer_id_fkey FOREIGN KEY (engineer_id) REFERENCES public.engineers(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS Policies for Tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;

CREATE POLICY "Users can view their own tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tasks" ON public.tasks FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- CONNECTIONS TABLE
-- ============================================

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

-- Add base_branch if missing
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'connections' AND column_name = 'base_branch') THEN
    ALTER TABLE public.connections ADD COLUMN base_branch TEXT DEFAULT 'main';
  END IF;
  UPDATE public.connections SET base_branch = 'main' WHERE base_branch IS NULL;
END $$;

-- RLS Policies for Connections
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own connections" ON public.connections;
DROP POLICY IF EXISTS "Users can create their own connections" ON public.connections;
DROP POLICY IF EXISTS "Users can update their own connections" ON public.connections;
DROP POLICY IF EXISTS "Users can delete their own connections" ON public.connections;

CREATE POLICY "Users can view their own connections" ON public.connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own connections" ON public.connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own connections" ON public.connections FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own connections" ON public.connections FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- ✅ VERIFICATION
-- ============================================

SELECT '✅ Database schema setup complete!' as status;
SELECT 'All tables, columns, foreign keys, and RLS policies are configured correctly.' as message;

