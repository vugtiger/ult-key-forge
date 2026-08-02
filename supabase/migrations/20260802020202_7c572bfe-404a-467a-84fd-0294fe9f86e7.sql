-- 1. Fix mutable search_path on SECURITY DEFINER functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- 2. Revoke public execution of SECURITY DEFINER functions that should be backend-only
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_tokens() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_discord_oauth() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_control_panel_keys() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_v2_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_admin_ban() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_admin_global_ban() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_tokens() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_discord_oauth() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_control_panel_keys() TO service_role;

-- has_role / has_v2_role stay executable: they are used inside RLS policies
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_v2_role(uuid, v2_app_role) TO authenticated, anon, service_role;

-- 3. Paste owners can read execution counters for their own pastes
CREATE POLICY "Paste owners can view execution counts"
ON public.paste_execution_counts
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.pastes p
  WHERE p.id = paste_execution_counts.paste_id
    AND p.user_id = auth.uid()
));

-- 4. Project owners can read checkpoint progress for their own projects
CREATE POLICY "Project owners can view checkpoint progress"
ON public.v2_checkpoint_progress
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.v2_projects pr
  WHERE pr.id = v2_checkpoint_progress.project_id
    AND pr.user_id = auth.uid()
));

-- 5. Checkpoints are no longer world-readable
DROP POLICY IF EXISTS "anyone reads active checkpoints" ON public.v2_checkpoints;
DROP POLICY IF EXISTS "Anyone reads active checkpoints" ON public.v2_checkpoints;

CREATE POLICY "Owners can view their checkpoints"
ON public.v2_checkpoints
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.v2_projects pr
    WHERE pr.id = v2_checkpoints.project_id
      AND pr.user_id = auth.uid()
  )
);