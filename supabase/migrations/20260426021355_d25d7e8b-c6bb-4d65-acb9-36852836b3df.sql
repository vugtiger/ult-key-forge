
-- v2 role enum
CREATE TYPE public.v2_app_role AS ENUM ('owner', 'user');

-- v2 user roles table (separate from v1 user_roles)
CREATE TABLE public.v2_user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.v2_app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.v2_user_roles ENABLE ROW LEVEL SECURITY;

-- security-definer role check
CREATE OR REPLACE FUNCTION public.has_v2_role(_user_id uuid, _role public.v2_app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.v2_user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "v2 users view own role" ON public.v2_user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2 owners manage roles" ON public.v2_user_roles
  FOR ALL USING (public.has_v2_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_v2_role(auth.uid(), 'owner'));

-- v2 profiles
CREATE TABLE public.v2_profiles (
  id UUID NOT NULL PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.v2_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2 view own profile" ON public.v2_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "v2 insert own profile" ON public.v2_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "v2 update own profile" ON public.v2_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "v2 owners view all profiles" ON public.v2_profiles FOR SELECT USING (public.has_v2_role(auth.uid(), 'owner'));

-- v2 projects
CREATE TABLE public.v2_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.v2_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2 owners view own projects" ON public.v2_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2 owners insert projects" ON public.v2_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "v2 owners update own projects" ON public.v2_projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "v2 owners delete own projects" ON public.v2_projects FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "v2 admins manage all projects" ON public.v2_projects FOR ALL USING (public.has_v2_role(auth.uid(), 'owner'));

-- v2 scripts
CREATE TABLE public.v2_scripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.v2_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  obfuscated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.v2_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2 view own scripts" ON public.v2_scripts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2 insert own scripts" ON public.v2_scripts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "v2 update own scripts" ON public.v2_scripts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "v2 delete own scripts" ON public.v2_scripts FOR DELETE USING (auth.uid() = user_id);

-- v2 keys
CREATE TABLE public.v2_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.v2_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  key_value TEXT NOT NULL UNIQUE,
  note TEXT,
  bound_hwid TEXT,
  bound_ip TEXT,
  bound_discord_id TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.v2_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2 view own keys" ON public.v2_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2 insert own keys" ON public.v2_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "v2 update own keys" ON public.v2_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "v2 delete own keys" ON public.v2_keys FOR DELETE USING (auth.uid() = user_id);

-- v2 blacklist
CREATE TABLE public.v2_blacklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.v2_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  entry_type TEXT NOT NULL,
  entry_value TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.v2_blacklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2 view own blacklist" ON public.v2_blacklist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2 insert own blacklist" ON public.v2_blacklist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "v2 delete own blacklist" ON public.v2_blacklist FOR DELETE USING (auth.uid() = user_id);

-- v2 webhooks
CREATE TABLE public.v2_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.v2_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  events JSONB NOT NULL DEFAULT '["redeem","exec","ban"]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.v2_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2 view own webhooks" ON public.v2_webhooks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2 insert own webhooks" ON public.v2_webhooks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "v2 update own webhooks" ON public.v2_webhooks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "v2 delete own webhooks" ON public.v2_webhooks FOR DELETE USING (auth.uid() = user_id);

-- v2 logs
CREATE TABLE public.v2_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.v2_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  hwid TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.v2_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2 view own logs" ON public.v2_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2 deny direct log inserts" ON public.v2_logs FOR INSERT WITH CHECK (false);
CREATE POLICY "v2 delete own logs" ON public.v2_logs FOR DELETE USING (auth.uid() = user_id);

-- v2 settings
CREATE TABLE public.v2_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  theme TEXT NOT NULL DEFAULT 'dark',
  accent_color TEXT NOT NULL DEFAULT '#7c3aed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.v2_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2 view own settings" ON public.v2_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "v2 insert own settings" ON public.v2_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "v2 update own settings" ON public.v2_settings FOR UPDATE USING (auth.uid() = user_id);

-- updated_at triggers (reuse existing function)
CREATE TRIGGER trg_v2_profiles_updated BEFORE UPDATE ON public.v2_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_v2_projects_updated BEFORE UPDATE ON public.v2_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_v2_scripts_updated BEFORE UPDATE ON public.v2_scripts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_v2_settings_updated BEFORE UPDATE ON public.v2_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- v2 signup handler — only creates v2 profile when raw_user_meta_data->>'app_version' = 'v2'
CREATE OR REPLACE FUNCTION public.handle_new_v2_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data ->> 'app_version' = 'v2' THEN
    INSERT INTO public.v2_profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)));

    INSERT INTO public.v2_user_roles (user_id, role) VALUES (NEW.id, 'user');
    INSERT INTO public.v2_settings (user_id) VALUES (NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_v2
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_v2_user();
