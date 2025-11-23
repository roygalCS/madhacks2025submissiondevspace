-- Update connections table to remove unused fields and add base_branch
-- This migration removes Windmill, Tavus, and Cursor API keys
-- and adds base_branch for GitHub configuration

-- Step 1: Add base_branch column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'connections' 
    AND column_name = 'base_branch'
  ) THEN
    ALTER TABLE public.connections ADD COLUMN base_branch TEXT DEFAULT 'main';
  END IF;
END $$;

-- Step 2: Remove unused API key columns (optional - uncomment if you want to remove them)
-- Note: These columns may still exist from old migrations, but we're not using them anymore

-- Uncomment these if you want to completely remove the columns:
-- ALTER TABLE public.connections DROP COLUMN IF EXISTS cursor_api_key;
-- ALTER TABLE public.connections DROP COLUMN IF EXISTS windmill_api_key;
-- ALTER TABLE public.connections DROP COLUMN IF EXISTS tavus_api_key;

-- Step 3: Set default base_branch for existing connections
UPDATE public.connections
SET base_branch = 'main'
WHERE base_branch IS NULL;

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'connections'
ORDER BY ordinal_position;

