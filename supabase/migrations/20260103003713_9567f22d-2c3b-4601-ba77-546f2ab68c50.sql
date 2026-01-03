-- Allow paste owners to update whitelist/blacklist expiration fields
CREATE POLICY "Users can update access control for their pastes"
ON public.paste_access_control
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.pastes
    WHERE pastes.id = paste_access_control.paste_id
      AND pastes.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.pastes
    WHERE pastes.id = paste_access_control.paste_id
      AND pastes.user_id = auth.uid()
  )
);