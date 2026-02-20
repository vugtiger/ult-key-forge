
-- Allow users to delete keys from their own panels
CREATE POLICY "Users can delete their own panel keys"
ON public.control_panel_keys
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.control_panels
  WHERE control_panels.id = control_panel_keys.panel_id
  AND control_panels.user_id = auth.uid()
));

-- Allow users to update keys in their own panels (assign user IDs)
CREATE POLICY "Users can update their own panel keys"
ON public.control_panel_keys
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.control_panels
  WHERE control_panels.id = control_panel_keys.panel_id
  AND control_panels.user_id = auth.uid()
));
