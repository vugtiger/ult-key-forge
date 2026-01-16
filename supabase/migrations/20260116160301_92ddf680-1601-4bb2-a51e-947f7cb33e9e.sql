-- Create referral_codes table for affiliate system
CREATE TABLE public.referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_referrals INTEGER DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0
);

-- Create referrals tracking table
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL,
  referral_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT DEFAULT 'pending',
  reward_claimed BOOLEAN DEFAULT false
);

-- Create changelog table
CREATE TABLE public.changelog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  changes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_major BOOLEAN DEFAULT false
);

-- Create subscription_tiers table
CREATE TABLE public.subscription_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  features JSONB DEFAULT '[]'::jsonb,
  stripe_price_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_subscriptions table
CREATE TABLE public.user_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  tier_id UUID REFERENCES public.subscription_tiers(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'inactive',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.changelog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Referral codes policies
CREATE POLICY "Users can view their own referral codes" ON public.referral_codes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own referral code" ON public.referral_codes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own referral codes" ON public.referral_codes
  FOR UPDATE USING (auth.uid() = user_id);

-- Referrals policies
CREATE POLICY "Users can view their referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "System can insert referrals" ON public.referrals
  FOR INSERT WITH CHECK (true);

-- Changelog policies (public read)
CREATE POLICY "Anyone can read changelog" ON public.changelog
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage changelog" ON public.changelog
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Subscription tiers policies (public read)
CREATE POLICY "Anyone can view subscription tiers" ON public.subscription_tiers
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage subscription tiers" ON public.subscription_tiers
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- User subscriptions policies
CREATE POLICY "Users can view their own subscription" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage subscriptions" ON public.user_subscriptions
  FOR ALL USING (true);

-- Insert default subscription tiers
INSERT INTO public.subscription_tiers (name, price, features, is_active) VALUES
  ('Free', 0, '["5 Pastes", "Basic Protection", "Community Support"]'::jsonb, true),
  ('Pro', 9.99, '["Unlimited Pastes", "Advanced Protection", "Priority Support", "Custom Themes", "API Access"]'::jsonb, true),
  ('Enterprise', 29.99, '["Everything in Pro", "White Label", "Dedicated Support", "Custom Integrations", "Analytics Dashboard"]'::jsonb, true);

-- Insert initial changelog entries
INSERT INTO public.changelog (version, title, description, changes, is_major) VALUES
  ('2.0.0', 'Major Update - Analytics & Premium', 'Introducing analytics dashboard, affiliate system, and premium tiers!', 
   '["Analytics Dashboard with charts", "Affiliate/Referral System", "Premium Subscription Tiers", "API Documentation", "PWA Support - Install as App"]'::jsonb, true),
  ('1.5.0', 'AI Assistant & Discord Bot', 'Added AI-powered script assistant and Discord bot integration.', 
   '["AI Script Assistant", "Discord Bot Commands", "Key System via Discord", "Whitelist Management"]'::jsonb, true),
  ('1.0.0', 'Initial Release', 'ULT LUA PROTECTS is live!', 
   '["Lua Script Protection", "Key System Generation", "Pastebin Feature", "User Authentication", "2FA Security"]'::jsonb, true);