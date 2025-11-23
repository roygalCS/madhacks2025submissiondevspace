-- Fix tasks table - ensure all columns exist and foreign keys are correct
-- Run this in Supabase SQL Editor

-- Step 1: Check current tasks table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'tasks'
ORDER BY ordinal_position;

-- Step 2: Ensure tasks table has all required columns
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  engineer_id UUID REFERENCES public.engineers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed')),
  output TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 3: Add missing columns if table already exists
DO $$ 
BEGIN
  -- Add description column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN description TEXT NOT NULL DEFAULT '';
  END IF;

  -- Add engineer_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'engineer_id'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN engineer_id UUID REFERENCES public.engineers(id) ON DELETE SET NULL;
  END IF;

  -- Add status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed'));
  END IF;

  -- Add output column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'output'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN output TEXT;
  END IF;

  -- Add created_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
  END IF;
END $$;

-- Step 4: Fix foreign key constraints
ALTER TABLE public.tasks 
DROP CONSTRAINT IF EXISTS tasks_user_id_fkey;

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Step 5: Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Step 6: Fix RLS policies for tasks
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;

CREATE POLICY "Users can view their own tasks"
  ON public.tasks
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tasks"
  ON public.tasks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON public.tasks
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks"
  ON public.tasks
  FOR DELETE
  USING (auth.uid() = user_id);

-- Success message
SELECT 'Tasks table has been fixed! Try loading tasks now.' as status;

