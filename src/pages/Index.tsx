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
import Tilt3DCard from "@/components/Tilt3DCard";
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

  const featureColumns = [
    {
      title: "Protect",
      description: "Hide source, lock by user, and keep raw script content out of the URL.",
      icon: Shield,
    },
    {
      title: "Control",
      description: "Generate keys, bind games, check HWID, and watch access from one panel.",
      icon: Key,
    },
    {
      title: "Scale",
      description: "Cloud-synced scripts, AI tools, and Discord integration in one place.",
      icon: Database,
    },
  ];

  const signalCards = [
    { icon: EyeOff, label: "Hide code", description: "Raw URL returns nothing useful. The executor pulls the protected payload." },
    { icon: Zap, label: "Fast loader", description: "Key check, feedback, and delivery happen in one round trip." },
    { icon: Bot, label: "Discord panels", description: "Hook script delivery and key redemption into your Discord workflow." },
    { icon: Save, label: "Cloud storage", description: "Scripts, keys, and access history stay synced." },
    { icon: Lock, label: "User locks", description: "Restrict by Roblox account, device, and protection mode." },
    { icon: Terminal, label: "Console output", description: "Loading bars and status print in the executor console." },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden grain-overlay">
      <CloudBackground />
      <SnowEffect />

      <div className="relative z-10 pb-12">
        {/* Navbar */}
        <nav className="container mx-auto px-3 py-4 sm:px-4">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card/40 px-2.5 py-2 backdrop-blur-2xl sm:px-5 sm:py-3">
            <div className="flex items-center gap-2 shrink-0">
              <CloudLogo size={28} />
              <h2 className="hidden text-sm font-bold tracking-wider text-foreground sm:block">
                ULT CLOUD
              </h2>
            </div>

            <div className="flex items-center gap-0.5 sm:gap-1.5 min-w-0">
              <SoundToggleBtn />
              <LastUpdatedBadge />
              <GoogleTranslate />
              <a href="https://discord.gg/hPywsq3yqw" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground h-8 px-2 text-xs">
                  <MessageSquare size={14} />
                  <span className="hidden sm:inline">Discord</span>
                </Button>
              </a>
              <Button onClick={() => navigate("/compare")} variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground h-8 px-2 text-xs">
                <Globe size={14} />
                <span className="hidden sm:inline">Compare</span>
              </Button>
              <Button onClick={() => navigate("/status")} variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground h-8 px-2 text-xs">
                <Activity size={14} />
                <span className="hidden sm:inline">Status</span>
              </Button>
              <Button onClick={() => navigate("/install")} variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground h-8 px-2 text-xs">
                <Download size={14} />
                <span className="hidden sm:inline">Install</span>
              </Button>
              <Button onClick={() => navigate("/auth")} size="sm" className="rounded-xl bg-foreground text-background px-2.5 sm:px-5 h-8 text-xs font-semibold hover:bg-foreground/90 whitespace-nowrap">
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
                Lua script protection
                <br />
                <span className="text-muted-foreground">that does not get</span>
                <br />
                in your way.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                Key delivery, source protection, and a real loader for Roblox executors. Free, no paid tiers.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" onClick={() => navigate("/auth")} className="rounded-xl bg-foreground text-background px-8 py-5 text-sm font-semibold hover:bg-foreground/90">
                  Open dashboard
                  <ArrowRight className="ml-2" size={16} />
                </Button>
                <a href="https://discord.gg/hPywsq3yqw" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="lg" className="rounded-xl border-border bg-card/30 px-8 py-5 text-sm hover:bg-card/50">
                    <MessageSquare className="mr-2" size={15} />
                    Join Discord
                  </Button>
                </a>
              </div>

              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><Shield size={13} /> Free, no paid tiers</div>
                <div className="flex items-center gap-2"><Zap size={13} /> Unlimited keys</div>
                <div className="flex items-center gap-2"><Terminal size={13} /> Console output in-game</div>
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
                <Tilt3DCard key={col.title} className="glass-card rounded-2xl">
                  <div className="p-7 transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-foreground/5 border border-border flex items-center justify-center mb-5">
                      <col.icon className="text-foreground" size={20} />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{col.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{col.description}</p>
                  </div>
                </Tilt3DCard>
              ))}
            </div>
          </section>

          {/* Signal cards */}
          <section>
            <div className="max-w-2xl mb-10">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">Around the loader</p>
              <h2 className="text-2xl font-bold md:text-3xl">Tools that come with it.</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {signalCards.map((card) => (
                <Tilt3DCard key={card.label} className="glass-card rounded-2xl" intensity={10}>
                  <div className="p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/5 border border-border">
                      <card.icon className="text-foreground" size={16} />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold">{card.label}</h3>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{card.description}</p>
                  </div>
                </Tilt3DCard>
              ))}
            </div>
          </section>

          <TabPreviews />

          {/* AI & Discord */}
          <section className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">Extras</p>
              <h2 className="text-2xl font-bold md:text-3xl">AI helpers and a Discord workflow.</h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                There is an AI script assistant built in, plus Discord bot commands for keys and panels.
              </p>
              <div className="mt-6 glass-card rounded-2xl p-5">
                <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                  <div className="rounded-xl bg-background/40 border border-border p-3">Custom key systems and protection modes.</div>
                  <div className="rounded-xl bg-background/40 border border-border p-3">Cloud storage, Discord bot, and AI helper.</div>
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
              <h2 className="mt-6 text-2xl font-bold md:text-3xl">Set up a script.</h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                Sign in, paste your script, generate a key or pick a protection mode, copy the loader. Done.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button onClick={() => navigate("/auth")} className="rounded-xl bg-foreground text-background px-8 font-semibold hover:bg-foreground/90" size="lg">
                  Create account
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
