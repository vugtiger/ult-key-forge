import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowRight,
  Bot,
  Cloud,
  Database,
  EyeOff,
  Key,
  Lock,
  MessageSquare,
  Palette,
  Save,
  Shield,
  Sparkles,
  Terminal,
  TrendingUp,
  Volume2,
  VolumeX,
  Zap,
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
      if (session) {
        navigate("/dashboard");
      }
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

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-[28rem] w-[28rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-24 left-1/3 h-64 w-64 rounded-full bg-foreground/10 blur-3xl" />
      </div>

      <div className="relative z-10 pb-12">
        <nav className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between rounded-[1.75rem] border border-border/40 bg-card/45 px-5 py-3 backdrop-blur-2xl">
            <div className="flex items-center gap-3">
              <CloudLogo size={32} className="text-foreground" />
              <h2 className="hidden text-lg font-bold tracking-wider text-foreground sm:block">
                ULT <span className="text-primary cloud-glow-text">CLOUD</span>
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <SoundToggleBtn />
              <LastUpdatedBadge />
              <GoogleTranslate />
              <a
                href="https://discord.gg/hPywsq3yqw"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                  <MessageSquare size={16} />
                  <span className="hidden sm:inline">Discord</span>
                </Button>
              </a>
              <Button onClick={() => navigate("/auth")} size="sm" className="rounded-xl bg-primary px-5 text-primary-foreground hover:bg-primary/90">
                Sign In
              </Button>
            </div>
          </div>
        </nav>

        <main className="container mx-auto space-y-24 px-4 pt-8">
          <section className="grid items-center gap-8 pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:pt-14">
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-sm text-primary">
                <Cloud size={14} />
                Purple cloud edition · faster loader feel
              </div>

              <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.92] tracking-[-0.06em] text-foreground md:text-7xl xl:text-[6.4rem]">
                Protect scripts with a loader that feels instant.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
                ULT Cloud wraps key delivery, protection, and live console feedback into a faster-looking flow that feels cleaner, sharper, and way more premium.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" onClick={() => navigate("/auth")} className="rounded-2xl bg-primary px-8 py-6 text-base text-primary-foreground hover:bg-primary/90">
                  Launch Dashboard
                  <ArrowRight className="ml-2" size={20} />
                </Button>
                <a href="https://discord.gg/hPywsq3yqw" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="lg" className="rounded-2xl border-primary/20 bg-card/40 px-8 py-6 text-base hover:bg-card/70">
                    <MessageSquare className="mr-2" size={18} />
                    Join Discord
                  </Button>
                </a>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {stats.map((stat) => (
                  <Card key={stat.label} className="rounded-[1.5rem] border-border/40 bg-card/45 p-4 backdrop-blur-xl">
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">{stat.label}</p>
                  </Card>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Shield size={16} className="text-primary" /> 100% free forever</div>
                <div className="flex items-center gap-2"><Zap size={16} className="text-primary" /> Unlimited keys</div>
                <div className="flex items-center gap-2"><Terminal size={16} className="text-primary" /> Live executor feedback</div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-3 rounded-[2rem] border border-primary/20 bg-primary/10 blur-2xl" />
              <div className="relative">
                <KeySystemPreview />
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
            <Card className="rounded-[2rem] border-primary/20 bg-primary/10 p-7 backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.36em] text-primary">Why this layout</p>
              <h2 className="mt-4 text-3xl font-bold text-foreground">Sharper look. Same clouds. Better flow.</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                The new direction keeps the cloud identity but trades the old flat blocks for layered glass panels, stronger hierarchy, and a loader-first hero that sells the product faster.
              </p>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              {featureColumns.map((column) => (
                <Card key={column.title} className="rounded-[2rem] border-border/40 bg-card/45 p-6 backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{column.eyebrow}</p>
                    <column.icon className="text-primary" size={18} />
                  </div>
                  <h3 className="mt-4 text-2xl font-bold text-foreground">{column.title}</h3>
                  <ul className="mt-5 space-y-4 text-sm leading-6 text-muted-foreground">
                    {column.points.map((point) => (
                      <li key={point} className="flex gap-3">
                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary/80" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </section>

          <section className="space-y-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/45 px-3 py-1 text-xs uppercase tracking-[0.28em] text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                Built for the full stack
              </div>
              <h2 className="mt-4 text-3xl font-bold md:text-4xl">Everything around the loader feels tighter now.</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {signalCards.map((card) => (
                <Card key={card.label} className="group rounded-[1.75rem] border-border/40 bg-card/45 p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/30">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
                    <card.icon className="text-primary" size={18} />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{card.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.description}</p>
                </Card>
              ))}
            </div>
          </section>

          <TabPreviews />

          <section className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/45 px-3 py-1 text-xs uppercase tracking-[0.28em] text-muted-foreground">
                <Bot className="h-3 w-3" />
                AI support
              </div>
              <h2 className="mt-4 text-3xl font-bold md:text-4xl">AI tools and live communities still stay front and center.</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                The redesign keeps the pieces your users already care about — script help, Discord presence, and live platform previews — but wraps them in a cleaner purple system.
              </p>

              <Card className="mt-6 rounded-[2rem] border-border/40 bg-card/45 p-6 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <TrendingUp className="text-primary" size={18} />
                  <p className="text-sm uppercase tracking-[0.28em] text-muted-foreground">Platform promise</p>
                </div>
                <div className="mt-5 grid gap-4 text-sm text-muted-foreground sm:grid-cols-2">
                  <div className="rounded-[1.25rem] border border-border/50 bg-background/35 p-4">Custom key systems, strong protection modes, and a loader that feels immediate.</div>
                  <div className="rounded-[1.25rem] border border-border/50 bg-background/35 p-4">Cloud storage, Discord tooling, and AI help built into one ecosystem.</div>
                </div>
              </Card>
            </div>

            <AIAssistantDemo />
          </section>

          <DiscordServerShowcase />

          <section className="mb-10">
            <Card className="relative overflow-hidden rounded-[2.25rem] border-primary/20 bg-card/50 p-10 text-center backdrop-blur-2xl">
              <div className="absolute inset-x-20 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
              <CloudLogo size={54} className="mx-auto text-primary" />
              <h2 className="mt-6 text-3xl font-bold md:text-4xl">Ready to switch the site into its final purple shape?</h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                Sign in, generate your keys, protect the raw URL, and let the loader sell the speed before the script even lands.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button onClick={() => navigate("/auth")} className="rounded-2xl bg-primary px-8 text-primary-foreground hover:bg-primary/90" size="lg">
                  Create Free Account
                </Button>
                <a href="https://discord.gg/hPywsq3yqw" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="lg" className="rounded-2xl border-primary/20 bg-card/40 hover:bg-card/70">
                    <MessageSquare className="mr-2" size={18} />
                    Join Discord
                  </Button>
                </a>
              </div>
            </Card>
          </section>

          <footer className="border-t border-border/20 pt-8 pb-4">
            <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <CloudLogo size={16} className="text-muted-foreground" />
              <p>ULT <span className="text-primary">CLOUD</span> PROTECTS -- faster loader feel, same cloud identity.</p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default Index;
