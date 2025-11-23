-- Fix missing created_at column in engineers table
-- This migration adds created_at if it doesn't exist

DO $$ 
BEGIN
  -- Check if created_at column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'engineers' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.engineers
    ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
    
    -- Update existing rows to have a timestamp
    UPDATE public.engineers
    SET created_at = now()
    WHERE created_at IS NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.engineers.created_at IS 'Timestamp when the engineer was created';

