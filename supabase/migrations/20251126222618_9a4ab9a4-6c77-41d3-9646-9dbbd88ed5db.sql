-- Create profiles table for user data
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create key_systems table
CREATE TABLE public.key_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  num_keys integer NOT NULL,
  theme_color text NOT NULL,
  ascii_text text NOT NULL,
  generated_code text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.key_systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own key systems"
  ON public.key_systems FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create key systems"
  ON public.key_systems FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own key systems"
  ON public.key_systems FOR DELETE
  USING (auth.uid() = user_id);

-- Create saved_scripts table
CREATE TABLE public.saved_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  script_content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.saved_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scripts"
  ON public.saved_scripts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create scripts"
  ON public.saved_scripts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scripts"
  ON public.saved_scripts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scripts"
  ON public.saved_scripts FOR DELETE
  USING (auth.uid() = user_id);

-- Create user_themes table for custom theme colors
CREATE TABLE public.user_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  primary_color text NOT NULL DEFAULT '255, 255, 255',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.user_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own theme"
  ON public.user_themes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own theme"
  ON public.user_themes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own theme"
  ON public.user_themes FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, new.email);
  
  INSERT INTO public.user_themes (user_id)
  VALUES (new.id);
  
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_saved_scripts_updated_at
  BEFORE UPDATE ON public.saved_scripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_themes_updated_at
  BEFORE UPDATE ON public.user_themes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();