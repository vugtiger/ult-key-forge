import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowRight, Bot, Cloud, Database, Download, EyeOff, Key, Lock,
  MessageSquare, Palette, Save, Shield, Sparkles, Terminal,
  TrendingUp, Volume2, VolumeX, Zap,
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
    { label: "Live Uptime", value: "99.9%" },
  ];

  const featureColumns = [
    {
      title: "Protect",
      eyebrow: "Loader speed",
      icon: Shield,
      points: [
        "Protected scripts resolve instantly once the loader URL runs.",
        "Hide Code and public protection keep raw source out of sight.",
        "User-locked access keeps keys tied to the right Roblox account.",
      ],
    },
    {
      title: "Control",
      eyebrow: "Panel management",
      icon: Key,
      points: [
        "Generate expiring keys, time-based access, and custom redemption flows.",
        "Manage game binds, HWID checks, and access rules in one place.",
        "Track who launched what, when, and from where without the clutter.",
      ],
    },
    {
      title: "Scale",
      eyebrow: "Cloud stack",
      icon: Database,
      points: [
        "Keep scripts, stats, and configs synced across your whole panel.",
        "Use AI and Discord tools without leaving the platform.",
        "Ship updates once and let every loadstring pull the latest build.",
      ],
    },
  ];

  const signalCards = [
    { icon: EyeOff, label: "Hide Code", description: "Raw URL stays blank while the executor still pulls the protected payload." },
    { icon: Zap, label: "Instant Sync", description: "Key checks, progress feedback, and final script delivery happen in one fast motion." },
    { icon: Bot, label: "Discord Panels", description: "Attach script delivery and key redemption to your Discord workflow." },
    { icon: Palette, label: "Purple Cloud UI", description: "A sharper visual system that still keeps the clouds and winter atmosphere." },
    { icon: Save, label: "Always Stored", description: "Scripts, keys, and access history stay backed up in the cloud." },
    { icon: Lock, label: "User Locks", description: "Restrict access by Roblox account, device signals, and protection mode." },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <CloudBackground />
      <SnowEffect />

      {/* Atmospheric blurs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-[28rem] w-[28rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-24 left-1/3 h-64 w-64 rounded-full bg-primary/8 blur-3xl" />
      </div>

      <div className="relative z-10 pb-12">
        {/* ─── Navbar ─── */}
        <nav className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between rounded-2xl border border-primary/15 bg-card/30 px-4 py-2.5 backdrop-blur-2xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                <CloudLogo size={20} className="text-primary" />
              </div>
              <h2 className="hidden text-sm font-bold tracking-wider text-foreground sm:block">
                ULT <span className="text-primary cloud-glow-text">CLOUD</span>
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
              <Button onClick={() => navigate("/install")} variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground h-8 text-xs">
                <Download size={14} />
                <span className="hidden sm:inline">Install</span>
              </Button>
              <Button onClick={() => navigate("/auth")} size="sm" className="rounded-lg bg-primary px-4 h-8 text-xs text-primary-foreground hover:bg-primary/90">
                Sign In
              </Button>
            </div>
          </div>
        </nav>

        <main className="container mx-auto space-y-20 px-4 pt-6">
          {/* ─── Hero ─── */}
          <section className="grid items-center gap-8 pt-6 lg:grid-cols-[1.05fr_0.95fr] lg:pt-10">
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-xs text-primary">
                <Cloud size={12} />
                Purple cloud edition · faster loader feel
              </div>

              <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[0.92] tracking-[-0.04em] text-foreground md:text-6xl xl:text-[5.5rem]">
                Protect scripts with a loader that feels instant.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                ULT Cloud wraps key delivery, protection, and live console feedback into a faster-looking flow that feels cleaner, sharper, and way more premium.
              </p>

              <div className="mt-7 flex flex-wrap gap-2.5">
                <Button size="lg" onClick={() => navigate("/auth")} className="rounded-xl bg-primary px-7 py-5 text-sm text-primary-foreground hover:bg-primary/90">
                  Launch Dashboard
                  <ArrowRight className="ml-2" size={16} />
                </Button>
                <a href="https://discord.gg/hPywsq3yqw" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="lg" className="rounded-xl border-primary/15 bg-card/30 px-7 py-5 text-sm hover:bg-card/50">
                    <MessageSquare className="mr-2" size={15} />
                    Join Discord
                  </Button>
                </a>
              </div>

              <div className="mt-8 grid gap-2.5 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-primary/12 bg-card/25 p-3.5 backdrop-blur-xl">
                    <p className="text-xl font-bold text-foreground">{stat.value}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5"><Shield size={13} className="text-primary" /> 100% free forever</div>
                <div className="flex items-center gap-1.5"><Zap size={13} className="text-primary" /> Unlimited keys</div>
                <div className="flex items-center gap-1.5"><Terminal size={13} className="text-primary" /> Live executor feedback</div>
              </div>
            </div>

            <div>
              <KeySystemPreview />
            </div>
          </section>

          {/* ─── Why section ─── */}
          <section className="grid gap-3 lg:grid-cols-[0.65fr_1.35fr]">
            <div className="rounded-2xl border border-primary/15 bg-primary/6 p-6 backdrop-blur-xl">
              <p className="text-[10px] uppercase tracking-[0.3em] text-primary">Why this layout</p>
              <h2 className="mt-3 text-2xl font-bold text-foreground">Sharper look. Same clouds. Better flow.</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The new direction keeps the cloud identity but trades the old flat blocks for layered glass panels, stronger hierarchy, and a loader-first hero that sells the product faster.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {featureColumns.map((column) => (
                <div key={column.title} className="rounded-2xl border border-primary/10 bg-card/25 p-5 backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{column.eyebrow}</p>
                    <column.icon className="text-primary" size={15} />
                  </div>
                  <h3 className="mt-3 text-xl font-bold text-foreground">{column.title}</h3>
                  <ul className="mt-4 space-y-3 text-xs leading-5 text-muted-foreground">
                    {column.points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/70 flex-shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* ─── Signal cards ─── */}
          <section className="space-y-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/12 bg-card/30 px-2.5 py-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                Built for the full stack
              </div>
              <h2 className="mt-3 text-2xl font-bold md:text-3xl">Everything around the loader feels tighter now.</h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {signalCards.map((card) => (
                <div key={card.label} className="group rounded-xl border border-primary/10 bg-card/25 p-4 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_8px_30px_hsl(var(--primary)/0.1)]">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/8">
                    <card.icon className="text-primary" size={15} />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">{card.label}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{card.description}</p>
                </div>
              ))}
            </div>
          </section>

          <TabPreviews />

          {/* ─── AI & Discord ─── */}
          <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/12 bg-card/30 px-2.5 py-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                <Bot className="h-3 w-3" />
                AI support
              </div>
              <h2 className="mt-3 text-2xl font-bold md:text-3xl">AI tools and live communities still stay front and center.</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The redesign keeps the pieces your users already care about — script help, Discord presence, and live platform previews — but wraps them in a cleaner purple system.
              </p>

              <div className="mt-5 rounded-2xl border border-primary/10 bg-card/25 p-5 backdrop-blur-xl">
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="text-primary" size={15} />
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Platform promise</p>
                </div>
                <div className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                  <div className="rounded-xl border border-primary/8 bg-background/25 p-3">Custom key systems, strong protection modes, and a loader that feels immediate.</div>
                  <div className="rounded-xl border border-primary/8 bg-background/25 p-3">Cloud storage, Discord tooling, and AI help built into one ecosystem.</div>
                </div>
              </div>
            </div>

            <AIAssistantDemo />
          </section>

          <DiscordServerShowcase />

          {/* ─── CTA ─── */}
          <section className="mb-8">
            <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-card/30 p-8 text-center backdrop-blur-2xl">
              <div className="absolute inset-x-20 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
              <CloudLogo size={44} className="mx-auto text-primary" />
              <h2 className="mt-5 text-2xl font-bold md:text-3xl">Ready to get started?</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                Sign in, generate your keys, protect the raw URL, and let the loader sell the speed before the script even lands.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                <Button onClick={() => navigate("/auth")} className="rounded-xl bg-primary px-7 text-primary-foreground hover:bg-primary/90" size="lg">
                  Create Free Account
                </Button>
                <a href="https://discord.gg/hPywsq3yqw" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="lg" className="rounded-xl border-primary/15 bg-card/30 hover:bg-card/50">
                    <MessageSquare className="mr-2" size={15} />
                    Join Discord
                  </Button>
                </a>
              </div>
            </div>
          </section>

          <footer className="border-t border-primary/8 pt-6 pb-4">
            <div className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <CloudLogo size={14} className="text-muted-foreground" />
              <p>ULT <span className="text-primary">CLOUD</span> PROTECTS -- faster loader feel, same cloud identity.</p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default Index;
