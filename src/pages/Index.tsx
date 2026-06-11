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
        {/* Floating capsule nav */}
        <nav className="sticky top-3 z-30 container mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between gap-2 rounded-full border border-border bg-card/60 px-2 py-1.5 backdrop-blur-2xl shadow-[var(--shadow-soft)] sm:px-3">
            <div className="flex items-center gap-2 shrink-0 pl-1">
              <CloudLogo size={26} />
              <h2 className="hidden text-[11px] font-black tracking-[0.22em] text-foreground sm:block">
                ULT CLOUD
              </h2>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
              <SoundToggleBtn />
              <LastUpdatedBadge />
              <GoogleTranslate />
              <Button onClick={() => navigate("/status")} variant="ghost" size="sm" className="rounded-full gap-1.5 bg-accent/15 text-foreground hover:bg-accent/25 h-8 px-2.5 text-xs font-semibold">
                <Activity size={14} /><span className="hidden md:inline">Status</span>
              </Button>
              <a href="https://discord.gg/hPywsq3yqw" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="rounded-full gap-1.5 bg-primary/15 text-foreground hover:bg-primary/25 h-8 px-2.5 text-xs font-semibold">
                  <MessageSquare size={14} /><span className="hidden md:inline">Discord</span>
                </Button>
              </a>
              <Button onClick={() => navigate("/install")} variant="ghost" size="sm" className="rounded-full gap-1.5 bg-accent/15 text-foreground hover:bg-accent/25 h-8 px-2.5 text-xs font-semibold">
                <Download size={14} /><span className="hidden md:inline">Install</span>
              </Button>
              <Button onClick={() => navigate("/auth")} size="sm" className="rounded-full bg-accent text-accent-foreground px-4 sm:px-5 h-8 text-xs font-bold shadow-[var(--shadow-pop)] whitespace-nowrap hover:bg-accent/90">
                Sign In
              </Button>
            </div>
          </div>
        </nav>

        <main className="container mx-auto space-y-24 px-4 pt-10">
          {/* Hero — flipped: preview LEFT, copy RIGHT */}
          <section className="grid items-center gap-10 pt-6 lg:grid-cols-[0.95fr_1.05fr] lg:pt-10">
            <div className="order-2 lg:order-1">
              <KeySystemPreview />
            </div>

            <div className="order-1 lg:order-2 relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1.5 mb-6 backdrop-blur-xl">
                <StatusDot />
              </div>

              <h1 className="text-4xl font-black leading-[0.95] tracking-[-0.04em] text-foreground md:text-6xl xl:text-[5.5rem] glow-text">
                <span className="bg-gradient-brand bg-clip-text text-transparent">Lua protection</span>
                <br />
                built like a&nbsp;
                <span className="italic font-serif text-muted-foreground">studio.</span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
                Key delivery, source protection, and a real loader for Roblox executors. Free, no paid tiers — ever.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" onClick={() => navigate("/auth")} className="rounded-full bg-gradient-brand text-background px-8 py-6 text-sm font-semibold shadow-[var(--shadow-pop)] hover:opacity-95">
                  Open dashboard
                  <ArrowRight className="ml-2" size={16} />
                </Button>
                <a href="https://discord.gg/hPywsq3yqw" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="lg" className="rounded-full border-border bg-card/40 px-8 py-6 text-sm hover:bg-card/60">
                    <MessageSquare className="mr-2" size={15} />
                    Join Discord
                  </Button>
                </a>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-3 max-w-md">
                {[
                  { icon: Shield, label: "Free forever" },
                  { icon: Zap, label: "Unlimited keys" },
                  { icon: Terminal, label: "In-game console" },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-3 text-center">
                    <s.icon size={15} className="mx-auto text-foreground mb-1.5" />
                    <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Pillars — asymmetric bento: first card wide */}
          <section>
            <div className="max-w-2xl mb-10">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">How it works</p>
              <h2 className="text-3xl md:text-4xl font-bold">Three pillars, <span className="italic font-serif text-muted-foreground">one loader.</span></h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3 md:grid-rows-[auto_auto]">
              {featureColumns.map((col, i) => (
                <Tilt3DCard
                  key={col.title}
                  className={`glass-card rounded-3xl ${i === 0 ? "md:col-span-2 md:row-span-1" : ""}`}
                >
                  <div className="p-7 transition-all duration-300 h-full">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-soft border border-border flex items-center justify-center mb-5 ${i === 0 ? "md:w-16 md:h-16" : ""}`}>
                      <col.icon className="text-foreground" size={i === 0 ? 22 : 20} />
                    </div>
                    <h3 className={`font-bold mb-3 ${i === 0 ? "text-2xl md:text-3xl" : "text-xl"}`}>{col.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-md">{col.description}</p>
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
                <Tilt3DCard key={card.label} className="glass-card rounded-3xl" intensity={10}>
                  <div className="p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-soft border border-border">
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

          {/* AI & Discord — flipped */}
          <section className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
            <AIAssistantDemo />
            <div className="lg:pl-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">Extras</p>
              <h2 className="text-2xl font-bold md:text-3xl">AI helpers <span className="italic font-serif text-muted-foreground">+</span> Discord flow.</h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Built-in script assistant, plus Discord bot commands for keys and panels.
              </p>
              <div className="mt-6 glass-card rounded-3xl p-5">
                <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                  <div className="rounded-2xl bg-background/40 border border-border p-3">Custom key systems and protection modes.</div>
                  <div className="rounded-2xl bg-background/40 border border-border p-3">Cloud storage, Discord bot, and AI helper.</div>
                </div>
              </div>
            </div>
          </section>

          <DiscordServerShowcase />

          {/* CTA — left-aligned bento */}
          <section className="mb-8">
            <div className="relative overflow-hidden glass-card rounded-[2rem] p-10 md:p-14 grid md:grid-cols-[1.3fr_0.7fr] gap-8 items-center">
              <div>
                <CloudLogo size={40} />
                <h2 className="mt-5 text-3xl font-bold md:text-4xl tracking-tight">
                  Set up a script in <span className="italic font-serif text-muted-foreground">minutes.</span>
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                  Sign in, paste your script, generate a key or pick a protection mode, copy the loader. Done.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button onClick={() => navigate("/auth")} className="rounded-full bg-gradient-brand text-background px-8 font-semibold shadow-[var(--shadow-pop)]" size="lg">
                    Create account
                  </Button>
                  <a href="https://discord.gg/hPywsq3yqw" target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="lg" className="rounded-full border-border bg-card/30 hover:bg-card/50">
                      <MessageSquare className="mr-2" size={15} />
                      Join Discord
                    </Button>
                  </a>
                </div>
              </div>
              <div className="hidden md:block relative">
                <div className="absolute inset-0 bg-gradient-brand opacity-20 blur-3xl rounded-full" />
                <div className="relative rounded-3xl border border-border bg-card/50 backdrop-blur-2xl p-6 space-y-3">
                  {["Paste script", "Generate keys", "Copy loader", "Ship it"].map((s, i) => (
                    <div key={s} className="flex items-center gap-3 text-sm">
                      <div className="w-7 h-7 rounded-full bg-gradient-brand text-background grid place-items-center text-xs font-bold">{i + 1}</div>
                      <span className="text-foreground/80">{s}</span>
                    </div>
                  ))}
                </div>
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
