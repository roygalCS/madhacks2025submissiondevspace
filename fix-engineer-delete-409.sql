-- Fix 409 error when deleting engineers
-- This ensures tasks table properly handles engineer deletion

-- Step 1: Verify tasks table has ON DELETE SET NULL
-- Check current foreign key constraint
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'tasks'
  AND kcu.column_name = 'engineer_id';

-- Step 2: If the constraint doesn't have ON DELETE SET NULL, fix it
-- Drop existing constraint if it exists
ALTER TABLE public.tasks 
DROP CONSTRAINT IF EXISTS tasks_engineer_id_fkey;

-- Recreate with ON DELETE SET NULL
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_engineer_id_fkey
FOREIGN KEY (engineer_id)
REFERENCES public.engineers(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Step 3: Verify RLS delete policy exists and is correct
DROP POLICY IF EXISTS "Users can delete their own engineers" ON public.engineers;

CREATE POLICY "Users can delete their own engineers"
  ON public.engineers
  FOR DELETE
  USING (auth.uid() = user_id);

-- Step 4: Test query (should return your engineers)
SELECT 
  id,
  name,
  (SELECT COUNT(*) FROM tasks WHERE engineer_id = engineers.id) as task_count
FROM engineers
WHERE user_id = auth.uid();

-- Success message
SELECT 'Engineer delete constraint fixed! You can now delete engineers.' as status;

