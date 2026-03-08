import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import CloudLogo from "@/components/CloudLogo";
import CloudBackground from "@/components/CloudBackground";
import SnowEffect from "@/components/SnowEffect";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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
        // Check login rate limit (non-blocking — don't let failures prevent login)
        try {
          const ratePromise = supabase.functions.invoke('track-ip', {
            body: { action: 'check_rate_limit', limit_action: 'login' }
          });
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
          const { data: loginRateCheck } = await Promise.race([ratePromise, timeoutPromise]) as any;
          if (loginRateCheck?.allowed === false) {
            throw new Error('Too many login attempts. Please wait before trying again.');
          }
        } catch (rateErr: any) {
          if (rateErr?.message?.includes('Too many login')) throw rateErr;
          console.warn('Rate limit check skipped:', rateErr?.message);
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // Track IP in background (non-blocking)
        supabase.functions.invoke('track-ip', {
          body: { user_id: data.user.id, action: 'login' }
        }).catch(() => {});
        
        navigate("/dashboard");
      } else {
        // Check signup rate limit (non-blocking)
        try {
          const ratePromise = supabase.functions.invoke('track-ip', {
            body: { action: 'check_rate_limit', limit_action: 'signup' }
          });
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
          const { data: signupRateCheck } = await Promise.race([ratePromise, timeoutPromise]) as any;
          if (signupRateCheck?.allowed === false) {
            throw new Error('You must wait 24 hours before creating another account from this location.');
          }
        } catch (rateErr: any) {
          if (rateErr?.message?.includes('wait 24 hours')) throw rateErr;
          console.warn('Rate limit check skipped:', rateErr?.message);
        }

        const { data: signupData, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` }
        });
        if (error) throw error;
        
        // Record signup in background (non-blocking)
        if (signupData.user) {
          supabase.functions.invoke('track-ip', {
            body: { user_id: signupData.user.id, action: 'register' }
          }).catch(() => {});
          supabase.functions.invoke('track-ip', {
            body: { action: 'record_signup' }
          }).catch(() => {});
        }
        
        toast({
          title: "Success!",
          description: "Account created successfully. You're now logged in.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      <CloudBackground />
      <SnowEffect />

      <div className="relative z-10 w-full max-w-md px-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={18} />
          Back to Home
        </Button>

        <Card className="p-8 bg-card/50 backdrop-blur-xl border-border/30 relative overflow-hidden rounded-2xl">
          <div className="relative">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center mb-4">
                <CloudLogo size={56} className="text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-wider">
                ULT <span className="text-primary cloud-glow-text">CLOUD</span>
              </h1>
              <h2 className="text-lg text-muted-foreground mt-1">
                {isLogin ? "Sign In" : "Create Account"}
              </h2>
            </div>
            
            <form onSubmit={handleAuth} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
                <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-background/50 border-border/50 focus:border-primary/50 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-background/50 border-border/50 focus:border-primary/50 pr-10 rounded-xl" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-xl" disabled={loading}>
                {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center space-y-3">
              <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-muted-foreground hover:text-primary transition-colors block w-full">
                {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
              </button>
              {isLogin && (
                <button onClick={() => navigate("/password-reset")} className="text-sm text-muted-foreground hover:text-primary transition-colors block w-full">
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
