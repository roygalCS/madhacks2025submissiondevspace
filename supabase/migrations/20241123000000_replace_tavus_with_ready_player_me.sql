-- Migration: Replace Tavus with Ready Player Me
-- This migration:
-- 1. Renames tavus_avatar_id to avatar_url in engineers table
-- 2. Removes tavus_api_key from connections table

-- Step 1: Add avatar_url column to engineers table (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'engineers' 
    AND column_name = 'avatar_url'
  ) THEN
    -- Add new column
    ALTER TABLE public.engineers ADD COLUMN avatar_url TEXT;
    
    -- Migrate data from tavus_avatar_id to avatar_url
    -- Convert Tavus avatar IDs to Ready Player Me URLs if they look like IDs
    UPDATE public.engineers
    SET avatar_url = CASE
      WHEN tavus_avatar_id IS NULL THEN NULL
      WHEN tavus_avatar_id LIKE 'http%' THEN tavus_avatar_id  -- Already a URL
      ELSE 'https://models.readyplayer.me/' || tavus_avatar_id || '.glb'  -- Convert ID to URL
    END
    WHERE tavus_avatar_id IS NOT NULL;
    
    -- Drop old column (commented out for safety - uncomment after verifying migration)
    -- ALTER TABLE public.engineers DROP COLUMN tavus_avatar_id;
  END IF;
END $$;

-- Step 2: Remove tavus_api_key from connections table
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'connections' 
    AND column_name = 'tavus_api_key'
  ) THEN
    ALTER TABLE public.connections DROP COLUMN tavus_api_key;
  END IF;
END $$;

-- Note: After verifying the migration works, you can uncomment the DROP COLUMN statement above
-- to permanently remove the tavus_avatar_id column from the engineers table.

