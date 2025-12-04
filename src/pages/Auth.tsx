import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
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

  // Check if user is banned
  const checkBanStatus = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('is_banned')
      .eq('id', userId)
      .single();
    
    return data?.is_banned || false;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // Check if user is banned
        if (data.user) {
          const isBanned = await checkBanStatus(data.user.id);
          if (isBanned) {
            await supabase.auth.signOut();
            throw new Error("Your account has been banned. Contact support for more information.");
          }
        }
      } else {
        // Require Discord username for signup
        if (!discordUsername.trim()) {
          throw new Error("Discord username is required");
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` }
        });
        if (error) throw error;
        
        // Update profile with Discord username and track IP
        if (data.user) {
          try {
            // Update profile with Discord username
            await supabase
              .from('profiles')
              .update({ discord_username: discordUsername.trim() })
              .eq('id', data.user.id);

            await supabase.functions.invoke('track-ip', {
              body: { user_id: data.user.id, action: 'register' }
            });
          } catch (ipError) {
            console.error('Error updating profile:', ipError);
          }
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
      {/* Animated grid background */}
      <div className="absolute inset-0 grid-bg opacity-30" />
      
      {/* Glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 gap-2"
        >
          <ArrowLeft size={18} />
          Back to Home
        </Button>

        {/* Auth Card */}
        <Card className="p-8 cyber-border bg-card/50 backdrop-blur-xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">ULT LUA PROTECTS</h1>
            <h2 className="text-xl text-muted-foreground">
              {isLogin ? "Sign In" : "Create Account"}
            </h2>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-6">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="discord">Discord Username</Label>
                <Input
                  id="discord"
                  type="text"
                  placeholder="username#1234 or username"
                  value={discordUsername}
                  onChange={(e) => setDiscordUsername(e.target.value)}
                  required={!isLogin}
                  className="bg-input border-border"
                />
              </div>
            )}

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
        </Card>
      </div>
    </div>
  );
};

export default Auth;
