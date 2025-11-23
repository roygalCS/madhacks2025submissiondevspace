-- Add GitHub repository fields to connections table
ALTER TABLE public.connections
ADD COLUMN IF NOT EXISTS github_username TEXT,
ADD COLUMN IF NOT EXISTS github_repo_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.connections.github_username IS 'GitHub username for repository access';
COMMENT ON COLUMN public.connections.github_repo_name IS 'GitHub repository name';


-- Add Tavus API key to connections table
ALTER TABLE public.connections
ADD COLUMN IF NOT EXISTS tavus_api_key TEXT;

COMMENT ON COLUMN public.connections.tavus_api_key IS 'Tavus API key for video avatar generation';
