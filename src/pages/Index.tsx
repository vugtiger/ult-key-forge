import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Key, Shield, Database, Bot, Palette, Save, Zap, Code, MessageSquare, ExternalLink, Sparkles, EyeOff, Clock, Lock, Terminal, TrendingUp } from "lucide-react";
import KeySystemPreview from "@/components/KeySystemPreview";
import AIAssistantDemo from "@/components/AIAssistantDemo";
import ReviewsSection from "@/components/ReviewsSection";
import LastUpdatedBadge from "@/components/LastUpdatedBadge";
import GoogleTranslate from "@/components/GoogleTranslate";
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
    { icon: Key, title: "Key System Generator", description: "Generate custom key systems with unlimited keys, custom colors, and ASCII art branding." },
    { icon: Shield, title: "User-Locked Keys", description: "Each key is locked to a single Roblox user ID for maximum security." },
    { icon: Database, title: "Script Storage", description: "Save and manage your Roblox scripts in one secure location." },
    { icon: Bot, title: "AI Assistant", description: "Get help generating Roblox scripts and build websites with AI." },
    { icon: Palette, title: "Theme Customization", description: "Fully customize the UI text colors to match your brand." },
    { icon: Save, title: "Cloud Backup", description: "All your data is securely stored and accessible anywhere." },
  ];

  const newFeatures = [
    { icon: EyeOff, title: "Hide Code", description: "Hide your code from the raw URL - shows blank but loadstring still works." },
    { icon: Zap, title: "Public Protection", description: "Encrypted protection without whitelist - anyone can execute but code stays safe." },
    { icon: Bot, title: "Discord Control Panels", description: "Create control panels with key redemption, role assignment, and script delivery." },
    { icon: Key, title: "Expiring Keys", description: "Generate keys with custom expiration times - minutes, hours, or days." },
    { icon: Shield, title: "Console Blacklist", description: "Blacklist users from control panels and force expire their access." },
    { icon: Clock, title: "Whitelist Time Management", description: "Set precise expiration times for whitelisted users." },
  ];

  const stats = [
    { label: "Protected Scripts", value: "10K+" },
    { label: "Active Users", value: "5K+" },
    { label: "Keys Generated", value: "1M+" },
    { label: "Uptime", value: "99.9%" },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated grid background */}
      <div className="absolute inset-0 grid-bg opacity-20" />
      
      {/* Red glow effects */}
      <div className="absolute top-[-200px] left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />
      <div className="absolute bottom-[-200px] right-1/4 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[150px]" />
      <div className="absolute top-1/2 left-[-100px] w-[300px] h-[300px] bg-primary/3 rounded-full blur-[100px]" />

      <div className="relative z-10">
        {/* Navigation */}
        <nav className="container mx-auto px-4 py-6 flex items-center justify-between border-b border-border/30">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img src={luaLogo} alt="Lua Logo" className="h-10 w-10 object-contain" />
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-md" />
            </div>
            <h2 className="text-xl font-bold tracking-wider text-foreground">
              ULT <span className="text-primary red-glow-text">LUA</span> PROTECTS
            </h2>
            <LastUpdatedBadge />
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 sm:gap-4">
              <a
                href="https://discord.gg/hPywsq3yqw"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-card/80 border border-border rounded-lg hover:border-primary/50 transition-all"
              >
                <MessageSquare size={18} className="text-primary" />
                <span className="hidden sm:inline text-sm">Discord</span>
                <ExternalLink size={14} className="text-muted-foreground" />
              </a>
              <Button onClick={() => navigate("/auth")} className="cyber-glow bg-primary text-primary-foreground hover:bg-primary/90">
                Sign In
              </Button>
            </div>
            <GoogleTranslate />
          </div>
        </nav>

        <div className="container mx-auto px-4 py-8">
          {/* Hero Section */}
          <div className="text-center mb-24 space-y-8 pt-16 relative">
            {/* Decorative lines */}
            <div className="absolute left-1/2 top-0 w-px h-16 bg-gradient-to-b from-transparent to-primary/30 -translate-x-1/2" />
            
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-sm text-primary mb-4">
              <Lock size={14} />
              <span className="font-medium">Protection v6.0 -- Advanced Security</span>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-none">
              <span className="text-foreground">ULT</span>
              <span className="text-primary red-glow-text"> LUA </span>
              <span className="text-foreground">PROTECTS</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-light tracking-wide">
              Advanced key system management and Roblox script protection platform. 
              Military-grade encryption. Zero compromises.
            </p>

            {/* Stats Row */}
            <div className="flex flex-wrap items-center justify-center gap-8 pt-4">
              {stats.map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-primary">{stat.value}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield size={16} className="text-primary" />
                <span>100% Free Forever</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap size={16} className="text-primary" />
                <span>Unlimited Keys</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Terminal size={16} className="text-primary" />
                <span>Anti-Logger Protection</span>
              </div>
            </div>

            <div className="pt-6 flex flex-wrap justify-center gap-4">
              <Button 
                size="lg" 
                className="cyber-glow text-lg px-10 py-7 bg-primary text-primary-foreground hover:bg-primary/90 tracking-wider"
                onClick={() => navigate("/auth")}
              >
                Get Started
                <ArrowRight className="ml-2" size={22} />
              </Button>
              <a
                href="https://discord.gg/hPywsq3yqw"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="text-lg px-10 py-7 border-primary/30 hover:bg-primary/10 hover:border-primary/50 tracking-wider"
                >
                  <MessageSquare size={20} className="mr-2 text-primary" />
                  Join Discord
                </Button>
              </a>
            </div>
          </div>

          {/* Features Section */}
          <section className="max-w-6xl mx-auto mb-28">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary uppercase tracking-widest mb-4">
                Core Features
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-3">
                Everything You Need
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                A complete toolkit for protecting your Roblox scripts with professional-grade key systems
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className="p-6 bg-card/60 backdrop-blur-xl border-border/50 hover:border-primary/30 transition-all duration-300 group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* New Features Section */}
          <section className="max-w-6xl mx-auto mb-28">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary uppercase tracking-widest mb-4">
                <Sparkles className="w-3 h-3" />
                Latest Updates
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-3">
                What's New
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Latest features and improvements to the platform
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {newFeatures.map((feature, index) => (
                <Card
                  key={index}
                  className="p-6 bg-card/60 backdrop-blur-xl border-border/50 hover:border-primary/30 transition-all duration-300 group relative overflow-hidden"
                >
                  <div className="absolute top-3 right-3 bg-primary/20 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    New
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* Key System Preview Section */}
          <section className="max-w-6xl mx-auto mb-28">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary uppercase tracking-widest mb-4">
                Preview
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-3">
                Key System Preview
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                See exactly what your users will see when they use your key system in Roblox
              </p>
            </div>
            <KeySystemPreview />
          </section>

          {/* AI Assistant Preview Section */}
          <section className="max-w-6xl mx-auto mb-28">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary uppercase tracking-widest mb-4">
                AI Powered
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-3">
                AI Assistant
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Get help with Roblox scripts, website building, and more with our powerful AI assistant
              </p>
            </div>
            <AIAssistantDemo />
          </section>

          {/* Reviews Section */}
          <ReviewsSection />

          {/* About Section */}
          <section className="max-w-5xl mx-auto mb-28">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">About ULT LUA PROTECTS</h2>
            </div>
            <Card className="p-8 bg-card/60 backdrop-blur-xl border-border/50 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent" />
              <div className="relative space-y-6">
                <p className="text-lg text-muted-foreground">
                  ULT LUA Protects is a comprehensive key system generator and script management platform designed specifically for Roblox developers.
                </p>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                      <TrendingUp size={20} className="text-primary" />
                      What We Provide
                    </h3>
                    <ul className="space-y-2.5 text-muted-foreground">
                      {[
                        { icon: Key, text: "Custom key systems with unlimited keys" },
                        { icon: Shield, text: "User ID locked keys for maximum security" },
                        { icon: Database, text: "Cloud-based script storage" },
                        { icon: Bot, text: "AI-powered script generation" },
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <item.icon size={16} className="text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                      <Lock size={20} className="text-primary" />
                      Our Promise
                    </h3>
                    <ul className="space-y-2.5 text-muted-foreground">
                      {[
                        { icon: Zap, text: "100% free forever - no hidden costs" },
                        { icon: Code, text: "Full source code in every download" },
                        { icon: Save, text: "Secure cloud storage for all data" },
                        { icon: Palette, text: "Full customization options" },
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <item.icon size={16} className="text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* CTA Section */}
          <section className="max-w-4xl mx-auto mb-20 text-center">
            <Card className="p-10 bg-card/60 backdrop-blur-xl border-primary/20 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
              <div className="relative">
                <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
                <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                  Join thousands of developers using ULT LUA Protects to secure their scripts
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Button
                    onClick={() => navigate("/auth")}
                    className="cyber-glow bg-primary text-primary-foreground hover:bg-primary/90 px-8"
                    size="lg"
                  >
                    Create Free Account
                  </Button>
                  <a
                    href="https://discord.gg/hPywsq3yqw"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="lg" className="gap-2 border-primary/30 hover:bg-primary/10">
                      <MessageSquare size={18} className="text-primary" />
                      Join Discord
                    </Button>
                  </a>
                </div>
              </div>
            </Card>
          </section>

          {/* Footer */}
          <footer className="border-t border-border/30 pt-8 pb-4">
            <div className="text-center text-sm text-muted-foreground">
              <p>ULT <span className="text-primary">LUA</span> PROTECTS -- 100% Free Forever</p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Index;
