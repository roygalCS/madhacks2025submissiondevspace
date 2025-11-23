-- Fix invalid avatar URLs in the database
-- This will update any engineers with invalid avatar URLs (like "01", "01.glb", etc.)
-- to use the default avatar URL

UPDATE public.engineers
SET avatar_url = 'https://models.readyplayer.me/69226336672cca15c2b4bb34.glb'
WHERE avatar_url IS NULL 
   OR avatar_url = ''
   OR avatar_url = '01'
   OR avatar_url = '01.glb'
   OR LENGTH(avatar_url) < 10
   OR (avatar_url NOT LIKE 'http%' AND avatar_url NOT LIKE '%.glb');

-- Verify the fix
SELECT id, name, avatar_url, 
       CASE 
         WHEN avatar_url IS NULL OR LENGTH(avatar_url) < 10 THEN 'INVALID'
         ELSE 'VALID'
       END as status
FROM public.engineers
ORDER BY created_at;

