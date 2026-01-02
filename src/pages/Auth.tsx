import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ArrowLeft, Shield } from "lucide-react";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFACode, setTwoFACode] = useState("");
  const [twoFASecret, setTwoFASecret] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && !requires2FA) navigate("/dashboard");
    });

    return () => subscription.unsubscribe();
  }, [navigate, requires2FA]);

  // Simple TOTP verification (time-based)
  const verifyTOTP = (secret: string, code: string): boolean => {
    const timeStep = Math.floor(Date.now() / 30000);
    const expectedCode = generateTOTP(secret, timeStep);
    const prevCode = generateTOTP(secret, timeStep - 1);
    const nextCode = generateTOTP(secret, timeStep + 1);
    
    return code === expectedCode || code === prevCode || code === nextCode;
  };

  const generateTOTP = (secret: string, timeStep: number): string => {
    let hash = 0;
    const input = secret + timeStep.toString();
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const code = Math.abs(hash % 1000000).toString().padStart(6, '0');
    return code;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Check if 2FA is enabled for this user
        const { data: twoFAData } = await supabase
          .from('user_2fa')
          .select('enabled, secret')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (twoFAData?.enabled && twoFAData?.secret) {
          // Sign out and require 2FA
          await supabase.auth.signOut();
          setRequires2FA(true);
          setTwoFASecret(twoFAData.secret);
          setPendingUserId(data.user.id);
          setLoading(false);
          return;
        }
        
        // No 2FA, proceed normally
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` }
        });
        if (error) throw error;
        
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

  const verify2FACode = async () => {
    if (twoFACode.length !== 6) {
      toast({ title: "Error", description: "Please enter a 6-digit code", variant: "destructive" });
      return;
    }

    setLoading(true);
    
    // Verify the TOTP code
    const isValid = verifyTOTP(twoFASecret, twoFACode);
    
    if (!isValid) {
      toast({ title: "Error", description: "Invalid 2FA code. Please try again.", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Re-authenticate
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      setRequires2FA(false);
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const cancel2FA = () => {
    setRequires2FA(false);
    setTwoFACode("");
    setTwoFASecret("");
    setPendingUserId(null);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      {/* Animated grid background */}
      <div className="absolute inset-0 grid-bg opacity-30" />
      
      {/* Glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => requires2FA ? cancel2FA() : navigate("/")}
          className="mb-6 gap-2"
        >
          <ArrowLeft size={18} />
          {requires2FA ? "Back to Login" : "Back to Home"}
        </Button>

        {/* Auth Card */}
        <Card className="p-8 cyber-border bg-card/50 backdrop-blur-xl">
          {requires2FA ? (
            <>
              <div className="text-center mb-8">
                <Shield className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h1 className="text-3xl font-bold mb-2">2FA Verification</h1>
                <h2 className="text-lg text-muted-foreground">
                  Enter the code from your authenticator app
                </h2>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="2fa-code">6-Digit Code</Label>
                  <Input
                    id="2fa-code"
                    type="text"
                    placeholder="000000"
                    value={twoFACode}
                    onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    className="bg-input border-border text-center text-2xl tracking-[0.5em] font-mono"
                  />
                </div>

                <Button
                  onClick={verify2FACode}
                  className="w-full cyber-glow"
                  disabled={loading || twoFACode.length !== 6}
                >
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">ULT LUA PROTECTS</h1>
                <h2 className="text-xl text-muted-foreground">
                  {isLogin ? "Sign In" : "Create Account"}
                </h2>
              </div>
              
              <form onSubmit={handleAuth} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-input border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-input border-border pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full cyber-glow"
                  disabled={loading}
                >
                  {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
                </Button>
              </form>

              <div className="mt-6 text-center space-y-3">
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors block w-full"
                >
                  {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
                </button>
                {isLogin && (
                  <button
                    onClick={() => navigate("/password-reset")}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors block w-full"
                  >
                    Forgot your password?
                  </button>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Auth;