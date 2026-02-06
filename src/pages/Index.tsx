import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Key, Shield, Database, Bot, Palette, Save, Zap, Code, MessageSquare, ExternalLink, Sparkles, EyeOff, Clock } from "lucide-react";
import KeySystemPreview from "@/components/KeySystemPreview";
import AIAssistantDemo from "@/components/AIAssistantDemo";
import ReviewsSection from "@/components/ReviewsSection";
import LastUpdatedBadge from "@/components/LastUpdatedBadge";
import GlobeVisualization from "@/components/GlobeVisualization";
import luaLogo from "@/assets/lua-logo.png";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  const features = [
    { icon: Key, title: "Key System Generator", description: "Generate custom key systems with unlimited keys, custom colors, and ASCII art branding.", isNew: false },
    { icon: Shield, title: "User-Locked Keys", description: "Each key is locked to a single Roblox user ID for maximum security.", isNew: false },
    { icon: Database, title: "Script Storage", description: "Save and manage your Roblox scripts in one secure location.", isNew: false },
    { icon: Bot, title: "AI Assistant", description: "Get help generating Roblox scripts and even build websites with AI.", isNew: false },
    { icon: Palette, title: "Theme Customization", description: "Fully customize the UI text colors to match your brand.", isNew: false },
    { icon: Save, title: "Cloud Backup", description: "All your data is securely stored and accessible anywhere.", isNew: false },
  ];

  const newFeatures = [
    { icon: EyeOff, title: "Hide Code", description: "Hide your code from the raw URL - shows blank but loadstring still works.", isNew: true },
    { icon: Zap, title: "Public Protection", description: "Encrypted protection without whitelist - anyone can execute but code stays safe.", isNew: true },
    { icon: Bot, title: "Discord Control Panels", description: "Create control panels with key redemption, role assignment, and script delivery.", isNew: true },
    { icon: Key, title: "Expiring Keys", description: "Generate keys with custom expiration times - minutes, hours, or days.", isNew: true },
    { icon: Shield, title: "Console Blacklist", description: "Blacklist users from control panels and force expire their access.", isNew: true },
    { icon: Clock, title: "Whitelist Time Management", description: "Set precise expiration times for whitelisted users.", isNew: true },
    { icon: Shield, title: "Discord Hawk", description: "Scan & track Discord server members to identify who views your pastes.", isNew: true },
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
          <div className="flex items-center gap-4">
            <img src={luaLogo} alt="Lua Logo" className="h-10 w-10 object-contain" />
            <h2 className="text-2xl font-bold text-foreground">ULT LUA PROTECTS</h2>
            <LastUpdatedBadge />
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://discord.gg/hPywsq3yqw"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-card/50 border border-border rounded-lg hover:bg-card/80 transition-colors cyber-glow"
            >
              <MessageSquare size={18} />
              <span className="hidden sm:inline">Discord</span>
              <ExternalLink size={14} />
            </a>
            <Button onClick={() => navigate("/auth")} className="cyber-glow">
              Sign In
            </Button>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-8">
          {/* Hero Section */}
          <div className="text-center mb-20 space-y-6 pt-12">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-4">
              <span className="text-foreground">
                ULT LUA PROTECTS
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
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
            <div className="pt-6">
              <Button 
                size="lg" 
                className="cyber-glow text-lg px-8 py-6"
                onClick={() => navigate("/auth")}
              >
                Get Started
                <ArrowRight className="ml-2" size={24} />
              </Button>
            </div>
          </div>

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
                  className="p-6 cyber-border bg-card/50 backdrop-blur-xl hover:bg-card/70 transition-all group relative"
                >
                  <feature.icon className="w-12 h-12 mb-4 text-foreground group-hover:scale-110 transition-transform" />
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              ))}
            </div>
          </section>

          {/* New Features Section */}
          <section className="max-w-6xl mx-auto mb-24">
            <h2 className="text-4xl font-bold text-center mb-4 flex items-center justify-center gap-3">
              What's New
              <Sparkles className="w-8 h-8 text-primary" />
            </h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Latest features and improvements to the platform
            </p>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {newFeatures.map((feature, index) => (
                <Card
                  key={index}
                  className="p-6 cyber-border bg-card/50 backdrop-blur-xl hover:bg-card/70 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    NEW
                  </div>
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

          {/* Reviews Section with Globe */}
          <section className="max-w-7xl mx-auto mb-24">
            <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
              <ReviewsSection />
              <div className="hidden lg:block sticky top-8">
                <GlobeVisualization />
              </div>
            </div>
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
                  onClick={() => navigate("/auth")}
                  className="cyber-glow"
                  size="lg"
                >
                  Create Free Account
                </Button>
                <a
                  href="https://discord.gg/hPywsq3yqw"
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

export default Index;