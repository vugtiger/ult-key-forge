-- Backfill v2 profile for existing user who tried to sign up on /v2
INSERT INTO public.v2_profiles (id, display_name)
VALUES ('96a83f2a-0984-4ab3-b78d-85fb6f540a98', 'awakenkillanova')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.v2_user_roles (user_id, role)
VALUES ('96a83f2a-0984-4ab3-b78d-85fb6f540a98', 'user')
ON CONFLICT DO NOTHING;

INSERT INTO public.v2_settings (user_id)
VALUES ('96a83f2a-0984-4ab3-b78d-85fb6f540a98')
ON CONFLICT DO NOTHING;