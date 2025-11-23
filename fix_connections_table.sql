-- Fix connections table - ensure all columns exist and foreign keys are correct
-- Run this in Supabase SQL Editor

-- Step 1: Check current connections table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'connections'
ORDER BY ordinal_position;

-- Step 2: Ensure connections table has all required columns
CREATE TABLE IF NOT EXISTS public.connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cursor_api_key TEXT,
  windmill_api_key TEXT,
  github_token TEXT,
  github_username TEXT,
  github_repo_name TEXT,
  tavus_api_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 3: Add missing columns if table already exists
DO $$ 
BEGIN
  -- Add cursor_api_key column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'connections' AND column_name = 'cursor_api_key'
  ) THEN
    ALTER TABLE public.connections ADD COLUMN cursor_api_key TEXT;
  END IF;

  -- Add windmill_api_key column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'connections' AND column_name = 'windmill_api_key'
  ) THEN
    ALTER TABLE public.connections ADD COLUMN windmill_api_key TEXT;
  END IF;

  -- Add github_token column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'connections' AND column_name = 'github_token'
  ) THEN
    ALTER TABLE public.connections ADD COLUMN github_token TEXT;
  END IF;

  -- Add github_username column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'connections' AND column_name = 'github_username'
  ) THEN
    ALTER TABLE public.connections ADD COLUMN github_username TEXT;
  END IF;

  -- Add github_repo_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'connections' AND column_name = 'github_repo_name'
  ) THEN
    ALTER TABLE public.connections ADD COLUMN github_repo_name TEXT;
  END IF;

  -- Add tavus_api_key column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'connections' AND column_name = 'tavus_api_key'
  ) THEN
    ALTER TABLE public.connections ADD COLUMN tavus_api_key TEXT;
  END IF;

  -- Add created_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'connections' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.connections ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
  END IF;

  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'connections' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.connections ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
  END IF;
END $$;

-- Step 4: Fix foreign key constraints
ALTER TABLE public.connections 
DROP CONSTRAINT IF EXISTS connections_user_id_fkey;

ALTER TABLE public.connections
ADD CONSTRAINT connections_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Step 5: Enable RLS
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- Step 6: Fix RLS policies for connections
DROP POLICY IF EXISTS "Users can view their own connections" ON public.connections;
DROP POLICY IF EXISTS "Users can create their own connections" ON public.connections;
DROP POLICY IF EXISTS "Users can update their own connections" ON public.connections;
DROP POLICY IF EXISTS "Users can delete their own connections" ON public.connections;

CREATE POLICY "Users can view their own connections"
  ON public.connections
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own connections"
  ON public.connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connections"
  ON public.connections
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connections"
  ON public.connections
  FOR DELETE
  USING (auth.uid() = user_id);

-- Step 7: Create or replace the update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create or replace the trigger
DROP TRIGGER IF EXISTS update_connections_updated_at ON public.connections;

CREATE TRIGGER update_connections_updated_at
  BEFORE UPDATE ON public.connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Success message
SELECT 'Connections table has been fixed! Try loading connections now.' as status;

