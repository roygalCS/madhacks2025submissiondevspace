-- Add specialty field to engineers table
ALTER TABLE public.engineers
ADD COLUMN IF NOT EXISTS specialty TEXT CHECK (specialty IN ('backend', 'frontend', 'fullstack', 'security', 'devops', 'mobile', 'ai/ml', 'general'));

COMMENT ON COLUMN public.engineers.specialty IS 'Engineer specialty area';
