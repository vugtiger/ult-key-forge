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

const readableAuthError = (error: any): string => {
  const raw =
    (typeof error === "string" && error) ||
    error?.message ||
    error?.error_description ||
    error?.error?.message ||
    error?.msg ||
    "";
  const text = String(raw).trim();
  if (!text || text === "{}" || text === "[object Object]") {
    return "We couldn't reach the sign-in service. Check your connection and try again in a moment.";
  }
  if (/failed to fetch|network|load failed/i.test(text)) {
    return "Connection problem — we couldn't reach the sign-in service. Please try again.";
  }
  if (/invalid login credentials/i.test(text)) {
    return "That email and password don't match. Double-check them and try again.";
  }
  if (/email not confirmed/i.test(text)) {
    return "Please confirm your email address first, then sign in.";
  }
  return text;
};

const getDeviceId = () => {
  const key = "ult_device_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID().replace(/-/g, "");
  localStorage.setItem(key, created);
  return created;
};

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
    const allowSession = async (session: any) => {
      if (!session) return;
      try {
        const data = await checkBan(session.user.id);
        if (data?.banned) {
          await supabase.auth.signOut();
          navigate('/auth', { state: { banReason: data.reason || 'You are permanently banned from ULT LUA.' } });
          return;
        }
      } catch {
        // a slow ban service should not keep a valid user stuck on the sign-in page
      }
      navigate("/dashboard");
    };
    supabase.auth.getSession().then(({ data: { session } }) => void allowSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) void allowSession(session);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const deviceId = getDeviceId();
      const { data: preBan, error: preBanError } = await supabase.functions.invoke('track-ip', {
        body: { action: 'check_ban', device_id: deviceId },
      });
      if (preBanError) throw new Error('Unable to verify access. Please try again.');
      if (preBan?.banned) throw new Error(preBan.reason || 'This device or network is permanently banned from ULT LUA.');
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
          const banPromise = supabase.functions.invoke('track-ip', { body: { user_id: data.user.id, action: 'check_ban', device_id: deviceId } });
          const banTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
          const { data: banCheck } = await Promise.race([banPromise, banTimeout]) as any;
          if (banCheck?.banned) {
            await supabase.auth.signOut();
            toast({ title: "Account Banned", description: banCheck.reason || "Your account has been banned.", variant: "destructive" });
            setLoading(false);
            return;
          }
        } catch (banError) {
          await supabase.auth.signOut();
          throw banError;
        }
        supabase.functions.invoke('track-ip', { body: { user_id: data.user.id, action: 'login', device_id: deviceId } }).catch(() => {});
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
        if (error) {
          const msg = String(error.message || "").toLowerCase();
          if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
            throw new Error("An account with this email already exists. Try signing in instead.");
          }
          throw error;
        }
        // Supabase returns a user with an empty identities array when the email
        // is already registered but unconfirmed — treat that as a duplicate too.
        if (signupData.user && Array.isArray((signupData.user as any).identities) && (signupData.user as any).identities.length === 0) {
          throw new Error("An account with this email already exists. Try signing in instead.");
        }
        if (signupData.user) {
          supabase.functions.invoke('track-ip', { body: { user_id: signupData.user.id, action: 'register', device_id: deviceId } }).catch(() => {});
          supabase.functions.invoke('track-ip', { body: { action: 'record_signup' } }).catch(() => {});
        }
        // If email confirmation is enabled, no session is returned yet.
        if (!signupData.session) {
          toast({
            title: "Check your email",
            description: `We sent a verification email to ${email}. Please confirm your address before signing in.`,
          });
          setIsLogin(true);
        } else {
          toast({ title: "Success!", description: "Account created successfully. You're now logged in." });
          try { localStorage.setItem("ult_last_creds", btoa(JSON.stringify({ email, password }))); } catch {}
        }
      }
    } catch (error: any) {
      toast({ title: "Error", description: readableAuthError(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center grain-overlay">
      <CloudBackground />
      <SnowEffect />

      <div className="relative z-10 w-full max-w-md px-4">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-6 gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
          Back to Home
        </Button>

        {banReason && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex items-start gap-3">
            <ShieldAlert className="text-destructive mt-0.5 shrink-0" size={20} />
            <div>
              <p className="text-sm font-semibold text-destructive">Account Banned</p>
              <p className="text-xs text-muted-foreground mt-1">{banReason}</p>
            </div>
          </div>
        )}

        <Card className="relative overflow-hidden rounded-2xl border-border bg-card/60 p-8 backdrop-blur-2xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
          <div className="relative">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center mb-4">
                <CloudLogo size={56} />
              </div>
              <h1 className="text-2xl font-bold tracking-wider">ULT CLOUD</h1>
              <h2 className="text-lg text-muted-foreground mt-1">
                {isLogin ? "Sign In" : "Create Account"}
              </h2>
            </div>
            
            <form onSubmit={handleAuth} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
                <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-background/50 border-border focus:border-foreground/30 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-background/50 border-border focus:border-foreground/30 pr-10 rounded-xl" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full rounded-xl bg-foreground text-background hover:bg-foreground/90 font-semibold" disabled={loading}>
                {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center space-y-3">
              <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-muted-foreground hover:text-foreground transition-colors block w-full">
                {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
              </button>
              {isLogin && (
                <button onClick={() => navigate("/password-reset")} className="text-sm text-muted-foreground hover:text-foreground transition-colors block w-full">
                  Forgot your password?
                </button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
