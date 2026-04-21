ALTER TABLE public.user_themes
  ADD COLUMN IF NOT EXISTS layout_preset text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS tab_radius integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS tab_density text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS tab_shape text NOT NULL DEFAULT 'pill';