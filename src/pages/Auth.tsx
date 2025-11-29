import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Zap, Shield, Code, Bot, Save, Palette, Key, Database, MessageSquare, ExternalLink } from "lucide-react";
import KeySystemPreview from "@/components/KeySystemPreview";
import AIAssistantDemo from "@/components/AIAssistantDemo";

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
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
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

  const features = [
    { icon: Key, title: "Key System Generator", description: "Generate custom key systems with unlimited keys, custom colors, and ASCII art branding." },
    { icon: Shield, title: "User-Locked Keys", description: "Each key is locked to a single Roblox user ID for maximum security." },
    { icon: Database, title: "Script Storage", description: "Save and manage your Roblox scripts in one secure location." },
    { icon: Bot, title: "AI Assistant", description: "Get help generating Roblox scripts and even build websites with AI." },
    { icon: Palette, title: "Theme Customization", description: "Fully customize the UI text colors to match your brand." },
    { icon: Save, title: "Cloud Backup", description: "All your data is securely stored and accessible anywhere." },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated grid background */}
      <div className="absolute inset-0 grid-bg opacity-30" />
      
      {/* Glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />

      <div className="relative z-10">
        {/* Navigation */}
        <nav className="container mx-auto px-4 py-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">ULT LUA PROTECTS</h2>
          <a
            href="https://discord.gg/qzYj6JY956"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-card/50 border border-border rounded-lg hover:bg-card/80 transition-colors cyber-glow"
          >
            <MessageSquare size={18} />
            <span>Discord</span>
            <ExternalLink size={14} />
          </a>
        </nav>

        <div className="container mx-auto px-4 py-8">
          {/* Hero Section */}
          <div className="text-center mb-16 space-y-6">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-4">
              <span className="text-foreground">
                ULT LUA PROTECTS
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Advanced key system management and Roblox script protection platform
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield size={16} className="text-foreground" />
                <span>100% Free Forever</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap size={16} className="text-foreground" />
                <span>Unlimited Keys</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Code size={16} className="text-foreground" />
                <span>AI Powered</span>
              </div>
            </div>
          </div>

          {/* Auth Card */}
          <Card className="max-w-md mx-auto p-8 cyber-border bg-card/50 backdrop-blur-xl mb-24">
            <h2 className="text-3xl font-bold text-center mb-8">
              {isLogin ? "Sign In" : "Create Account"}
            </h2>
            
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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

            <div className="mt-6 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </Card>

          {/* Features Section */}
          <section className="max-w-6xl mx-auto mb-24">
            <h2 className="text-4xl font-bold text-center mb-4">
              Everything You Need
            </h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              A complete toolkit for protecting your Roblox scripts with professional-grade key systems
            </p>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className="p-6 cyber-border bg-card/50 backdrop-blur-xl hover:bg-card/70 transition-all group"
                >
                  <feature.icon className="w-12 h-12 mb-4 text-foreground group-hover:scale-110 transition-transform" />
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              ))}
            </div>
          </section>

          {/* Key System Preview Section */}
          <section className="max-w-6xl mx-auto mb-24">
            <h2 className="text-4xl font-bold text-center mb-4">
              Key System Preview
            </h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              See exactly what your users will see when they use your key system in Roblox
            </p>
            <KeySystemPreview />
          </section>

          {/* AI Assistant Preview Section */}
          <section className="max-w-6xl mx-auto mb-24">
            <h2 className="text-4xl font-bold text-center mb-4">
              AI Assistant
            </h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Get help with Roblox scripts, website building, and more with our powerful AI assistant
            </p>
            <AIAssistantDemo />
          </section>

          {/* About Section */}
          <section className="max-w-4xl mx-auto mb-24 text-center">
            <h2 className="text-4xl font-bold mb-6">About ULT LUA PROTECTS</h2>
            <Card className="p-8 cyber-border bg-card/50 backdrop-blur-xl">
              <div className="space-y-6 text-left">
                <p className="text-lg text-muted-foreground">
                  ULT LUA Protects is a comprehensive key system generator and script management platform designed specifically for Roblox developers.
                </p>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-foreground">What We Provide</h3>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <Key size={18} className="text-foreground mt-0.5 flex-shrink-0" />
                        <span>Custom key systems with unlimited keys</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Shield size={18} className="text-foreground mt-0.5 flex-shrink-0" />
                        <span>User ID locked keys for maximum security</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Database size={18} className="text-foreground mt-0.5 flex-shrink-0" />
                        <span>Cloud-based script storage</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Bot size={18} className="text-foreground mt-0.5 flex-shrink-0" />
                        <span>AI-powered script generation</span>
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-foreground">Our Promise</h3>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <Zap size={18} className="text-foreground mt-0.5 flex-shrink-0" />
                        <span>100% free forever - no hidden costs</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Code size={18} className="text-foreground mt-0.5 flex-shrink-0" />
                        <span>Full source code in every download</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Save size={18} className="text-foreground mt-0.5 flex-shrink-0" />
                        <span>Secure cloud storage for all data</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Palette size={18} className="text-foreground mt-0.5 flex-shrink-0" />
                        <span>Full customization options</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* CTA Section */}
          <section className="max-w-4xl mx-auto mb-16 text-center">
            <Card className="p-8 cyber-border bg-card/50 backdrop-blur-xl">
              <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
              <p className="text-muted-foreground mb-6">
                Join thousands of developers using ULT LUA Protects to secure their scripts
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="cyber-glow"
                  size="lg"
                >
                  Create Free Account
                </Button>
                <a
                  href="https://discord.gg/qzYj6JY956"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="lg" className="gap-2">
                    <MessageSquare size={18} />
                    Join Discord
                  </Button>
                </a>
              </div>
            </Card>
          </section>

          {/* Footer */}
          <footer className="border-t border-border/50 pt-8 pb-4">
            <div className="text-center text-sm text-muted-foreground">
              <p>ULT LUA PROTECTS - 100% Free Forever</p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Auth;
