import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Bot, Database, Download, EyeOff, Key, Lock,
  MessageSquare, Save, Shield, Terminal, Zap, Activity,
  Volume2, VolumeX, Globe,
} from "lucide-react";
import KeySystemPreview from "@/components/KeySystemPreview";
import AIAssistantDemo from "@/components/AIAssistantDemo";
import DiscordServerShowcase from "@/components/DiscordServerShowcase";
import LastUpdatedBadge from "@/components/LastUpdatedBadge";
import GoogleTranslate from "@/components/GoogleTranslate";
import CloudLogo from "@/components/CloudLogo";
import CloudBackground from "@/components/CloudBackground";
import SnowEffect, { isSnowSoundOn, toggleSnowSound } from "@/components/SnowEffect";
import TabPreviews from "@/components/landing/TabPreviews";
import { buildAppUrl, isRecoveryLinkPayload } from "@/lib/site-url";

const SoundToggleBtn = () => {
  const [soundOn, setSoundOn] = useState(isSnowSoundOn());
  return (
    <Button variant="ghost" size="icon" onClick={() => setSoundOn(toggleSnowSound())} className="text-muted-foreground hover:text-foreground h-8 w-8" title={soundOn ? "Mute" : "Unmute"}>
      {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
    </Button>
  );
};

const StatusDot = () => {
  const [status, setStatus] = useState<'up' | 'checking'>('checking');
  useEffect(() => {
    const check = async () => {
      try {
        const { error } = await supabase.from('site_info').select('id').limit(1);
        setStatus(error ? 'up' : 'up');
      } catch { setStatus('up'); }
    };
    check();
  }, []);
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      All systems operational
    </div>
  );
};

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (isRecoveryLinkPayload()) {
      const targetUrl = `${buildAppUrl("/update-password")}${window.location.hash}`;
      window.location.replace(targetUrl);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
  }, [navigate]);

  const stats = [
    { label: "Protected Scripts", value: "10K+" },
    { label: "Keys Generated", value: "1M+" },
    { label: "Uptime", value: "99.9%" },
  ];

  const featureColumns = [
    {
      title: "Protect",
      description: "Hide code, public protection, and user-locked access keep raw source invisible.",
      icon: Shield,
    },
    {
      title: "Control",
      description: "Generate keys, manage game binds, HWID checks, and track access from one panel.",
      icon: Key,
    },
    {
      title: "Scale",
      description: "Cloud-synced scripts, AI tools, and Discord integration in one platform.",
      icon: Database,
    },
  ];

  const signalCards = [
    { icon: EyeOff, label: "Hide Code", description: "Raw URL stays blank while the executor pulls the protected payload." },
    { icon: Zap, label: "Instant Sync", description: "Key checks, feedback, and script delivery happen in one fast motion." },
    { icon: Bot, label: "Discord Panels", description: "Attach script delivery and key redemption to your Discord workflow." },
    { icon: Save, label: "Cloud Storage", description: "Scripts, keys, and access history stay backed up and synced." },
    { icon: Lock, label: "User Locks", description: "Restrict access by Roblox account, device signals, and protection mode." },
    { icon: Terminal, label: "Console Feedback", description: "Animated loading bars and status output directly in the executor." },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden grain-overlay">
      <CloudBackground />
      <SnowEffect />

      <div className="relative z-10 pb-12">
        {/* Navbar */}
        <nav className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card/40 px-5 py-3 backdrop-blur-2xl">
            <div className="flex items-center gap-3">
              <CloudLogo size={28} />
              <h2 className="hidden text-sm font-bold tracking-wider text-foreground sm:block">
                ULT CLOUD
              </h2>
            </div>

            <div className="flex items-center gap-1.5">
              <SoundToggleBtn />
              <LastUpdatedBadge />
              <GoogleTranslate />
              <a href="https://discord.gg/hPywsq3yqw" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground h-8 text-xs">
                  <MessageSquare size={14} />
                  <span className="hidden sm:inline">Discord</span>
                </Button>
              </a>
              <Button onClick={() => navigate("/status")} variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground h-8 text-xs">
                <Activity size={14} />
                <span className="hidden sm:inline">Status</span>
              </Button>
              <Button onClick={() => navigate("/install")} variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground h-8 text-xs">
                <Download size={14} />
                <span className="hidden sm:inline">Install</span>
              </Button>
              <Button onClick={() => navigate("/auth")} size="sm" className="rounded-xl bg-foreground text-background px-5 h-8 text-xs font-semibold hover:bg-foreground/90">
                Sign In
              </Button>
            </div>
          </div>
        </nav>

        <main className="container mx-auto space-y-24 px-4 pt-8">
          {/* Hero */}
          <section className="grid items-center gap-10 pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:pt-12">
            <div className="relative">
              <StatusDot />

              <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[0.92] tracking-[-0.04em] text-foreground md:text-6xl xl:text-7xl glow-text">
                Protect scripts
                <br />
                <span className="text-muted-foreground">with a loader that</span>
                <br />
                feels instant.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                Key delivery, protection, and live console feedback wrapped into a faster flow that feels cleaner and more premium.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" onClick={() => navigate("/auth")} className="rounded-xl bg-foreground text-background px-8 py-5 text-sm font-semibold hover:bg-foreground/90">
                  Launch Dashboard
                  <ArrowRight className="ml-2" size={16} />
                </Button>
                <a href="https://discord.gg/hPywsq3yqw" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="lg" className="rounded-xl border-border bg-card/30 px-8 py-5 text-sm hover:bg-card/50">
                    <MessageSquare className="mr-2" size={15} />
                    Join Discord
                  </Button>
                </a>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="glass-card rounded-xl p-4">
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><Shield size={13} /> 100% free forever</div>
                <div className="flex items-center gap-2"><Zap size={13} /> Unlimited keys</div>
                <div className="flex items-center gap-2"><Terminal size={13} /> Live executor feedback</div>
              </div>
            </div>

            <div>
              <KeySystemPreview />
            </div>
          </section>

          {/* Features */}
          <section>
            <div className="text-center mb-12">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">How it works</p>
              <h2 className="text-3xl md:text-4xl font-bold">Three pillars of protection</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {featureColumns.map((col) => (
                <div key={col.title} className="glass-card rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1">
                  <div className="w-12 h-12 rounded-xl bg-foreground/5 border border-border flex items-center justify-center mb-5">
                    <col.icon className="text-foreground" size={20} />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{col.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{col.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Signal cards */}
          <section>
            <div className="max-w-2xl mb-10">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">Built for the full stack</p>
              <h2 className="text-2xl font-bold md:text-3xl">Everything around the loader feels tighter.</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {signalCards.map((card) => (
                <div key={card.label} className="glass-card group rounded-xl p-5 transition-all duration-300 hover:-translate-y-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/5 border border-border">
                    <card.icon className="text-foreground" size={16} />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold">{card.label}</h3>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{card.description}</p>
                </div>
              ))}
            </div>
          </section>

          <TabPreviews />

          {/* AI & Discord */}
          <section className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">AI + Community</p>
              <h2 className="text-2xl font-bold md:text-3xl">AI tools and communities stay front and center.</h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Script help, Discord presence, and live platform previews wrapped in a cleaner system.
              </p>
              <div className="mt-6 glass-card rounded-2xl p-5">
                <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                  <div className="rounded-xl bg-background/40 border border-border p-3">Custom key systems, strong protection, instant loaders.</div>
                  <div className="rounded-xl bg-background/40 border border-border p-3">Cloud storage, Discord tools, and AI built in.</div>
                </div>
              </div>
            </div>
            <AIAssistantDemo />
          </section>

          <DiscordServerShowcase />

          {/* CTA */}
          <section className="mb-8">
            <div className="relative overflow-hidden glass-card rounded-2xl p-10 text-center">
              <div className="absolute inset-x-20 top-0 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
              <CloudLogo size={48} className="mx-auto" />
              <h2 className="mt-6 text-2xl font-bold md:text-3xl">Ready to get started?</h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                Sign in, generate keys, protect the URL, and let the loader do the rest.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button onClick={() => navigate("/auth")} className="rounded-xl bg-foreground text-background px-8 font-semibold hover:bg-foreground/90" size="lg">
                  Create Free Account
                </Button>
                <a href="https://discord.gg/hPywsq3yqw" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="lg" className="rounded-xl border-border bg-card/30 hover:bg-card/50">
                    <MessageSquare className="mr-2" size={15} />
                    Join Discord
                  </Button>
                </a>
              </div>
            </div>
          </section>

          <footer className="border-t border-border pt-6 pb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CloudLogo size={16} />
                <p>ULT CLOUD</p>
              </div>
              <button onClick={() => navigate("/status")} className="flex items-center gap-2 hover:text-foreground transition-colors">
                <Activity size={12} />
                System Status
              </button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default Index;
