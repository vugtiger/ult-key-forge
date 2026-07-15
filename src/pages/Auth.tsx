import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ArrowLeft, ShieldAlert } from "lucide-react";
import CloudLogo from "@/components/CloudLogo";
import CloudBackground from "@/components/CloudBackground";
import SnowEffect from "@/components/SnowEffect";
import { buildAppUrl } from "@/lib/site-url";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const getSavedCreds = () => {
    try {
      const raw = localStorage.getItem("ult_last_creds");
      if (!raw) return { email: "", password: "" };
      const decoded = JSON.parse(atob(raw));
      return { email: decoded.email || "", password: decoded.password || "" };
    } catch {
      return { email: "", password: "" };
    }
  };
  const saved = getSavedCreds();
  const [email, setEmail] = useState(saved.email);
  const [password, setPassword] = useState(saved.password);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const banReason = (location.state as any)?.banReason;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate("/dashboard");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        try {
          const ratePromise = supabase.functions.invoke('track-ip', { body: { action: 'check_rate_limit', limit_action: 'login' } });
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
          const { data: loginRateCheck } = await Promise.race([ratePromise, timeoutPromise]) as any;
          if (loginRateCheck?.allowed === false) throw new Error('Too many login attempts. Please wait before trying again.');
        } catch (rateErr: any) {
          if (rateErr?.message?.includes('Too many login')) throw rateErr;
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        try {
          const { data: banCheck } = await supabase.functions.invoke('track-ip', { body: { user_id: data.user.id, action: 'check_ban' } });
          if (banCheck?.banned) {
            await supabase.auth.signOut();
            toast({ title: "Account Banned", description: banCheck.reason || "Your account has been banned.", variant: "destructive" });
            setLoading(false);
            return;
          }
        } catch {}
        supabase.functions.invoke('track-ip', { body: { user_id: data.user.id, action: 'login' } }).catch(() => {});
        try { localStorage.setItem("ult_last_creds", btoa(JSON.stringify({ email, password }))); } catch {}
        navigate("/dashboard");
      } else {
        try {
          const ratePromise = supabase.functions.invoke('track-ip', { body: { action: 'check_rate_limit', limit_action: 'signup' } });
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
          const { data: signupRateCheck } = await Promise.race([ratePromise, timeoutPromise]) as any;
          if (signupRateCheck?.allowed === false) throw new Error('You must wait 24 hours before creating another account from this location.');
        } catch (rateErr: any) {
          if (rateErr?.message?.includes('wait 24 hours')) throw rateErr;
        }
        const { data: signupData, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: buildAppUrl("/") } });
        if (error) throw error;
        if (signupData.user) {
          supabase.functions.invoke('track-ip', { body: { user_id: signupData.user.id, action: 'register' } }).catch(() => {});
          supabase.functions.invoke('track-ip', { body: { action: 'record_signup' } }).catch(() => {});
        }
        toast({ title: "Success!", description: "Account created successfully. You're now logged in." });
        try { localStorage.setItem("ult_last_creds", btoa(JSON.stringify({ email, password }))); } catch {}
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden grain-overlay">
      <CloudBackground />
      <SnowEffect />

      <Button variant="ghost" onClick={() => navigate("/")} className="absolute top-4 left-4 z-20 gap-2 rounded-full text-muted-foreground hover:text-foreground backdrop-blur-xl bg-card/40 border border-border">
        <ArrowLeft size={16} />
        Home
      </Button>

      <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
        {/* Brand panel (desktop only) */}
        <div className="hidden lg:flex relative overflow-hidden items-center justify-center p-10">
          <div className="absolute inset-6 rounded-[2.5rem] bg-gradient-soft border border-border shadow-[var(--shadow-soft)]" />
          <div className="absolute inset-6 rounded-[2.5rem] bg-gradient-brand opacity-10" />
          <div className="relative max-w-md text-center space-y-6">
            <CloudLogo size={88} className="mx-auto" />
            <h1 className="text-5xl font-black tracking-tight leading-[0.95]">
              Welcome to <br />
              <span className="bg-gradient-brand bg-clip-text text-transparent">ULT CLOUD</span>
            </h1>
            <p className="text-sm text-muted-foreground leading-6">
              The free protection studio for Roblox Lua. Keys, loaders, panels — all in one place.
            </p>
            <div className="grid grid-cols-3 gap-2 pt-4">
              {["Free forever", "No paid tiers", "Unlimited keys"].map((s) => (
                <div key={s} className="rounded-2xl border border-border bg-card/60 backdrop-blur-xl px-2 py-2.5 text-[10px] text-foreground/70 font-medium">
                  {s}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md">
            {banReason && (
              <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-2xl flex items-start gap-3">
                <ShieldAlert className="text-destructive mt-0.5 shrink-0" size={20} />
                <div>
                  <p className="text-sm font-semibold text-destructive">Account Banned</p>
                  <p className="text-xs text-muted-foreground mt-1">{banReason}</p>
                </div>
              </div>
            )}

            <Card className="relative overflow-hidden rounded-[2rem] border-border bg-card/70 p-8 backdrop-blur-2xl shadow-[var(--shadow-soft)]">
              <div className="lg:hidden text-center mb-6">
                <CloudLogo size={48} className="mx-auto" />
              </div>
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
                  {isLogin ? "Account" : "Get started"}
                </p>
                <h2 className="text-3xl font-bold tracking-tight">
                  {isLogin ? "Sign in" : "Create account"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {isLogin ? "Welcome back — pick up where you left off." : "It's free, forever. No card needed."}
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
                  <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-background/60 border-border focus:border-foreground/30 rounded-2xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs text-muted-foreground">Password</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-background/60 border-border focus:border-foreground/30 pr-10 rounded-2xl h-11" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 rounded-2xl bg-gradient-brand text-background font-semibold shadow-[var(--shadow-pop)] hover:opacity-95" disabled={loading}>
                  {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
                </Button>
              </form>

              <div className="mt-6 pt-5 border-t border-border text-center space-y-2.5">
                <button onClick={() => setIsLogin(!isLogin)} className="text-xs text-muted-foreground hover:text-foreground transition-colors block w-full">
                  {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
                </button>
                {isLogin && (
                  <button onClick={() => navigate("/password-reset")} className="text-xs text-muted-foreground hover:text-foreground transition-colors block w-full">
                    Forgot your password?
                  </button>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
