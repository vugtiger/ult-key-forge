import { ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

import { NavLink } from "@/components/NavLink";
import { Zap, Save, Bot, Settings, LogOut, FileCode, Shield, MessageSquare, BarChart3, History, Eye, Volume2, VolumeX, Key, Sparkles, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import CloudLogo from "@/components/CloudLogo";
import CloudBackground from "@/components/CloudBackground";
import SnowEffect, { toggleSnowSound, isSnowSoundOn } from "@/components/SnowEffect";
import { applyDashboardLayout, LayoutPreset, TabDensity, TabShape } from "@/components/DashboardCustomizer";

const navigationItems = [
  { title: "Key System", url: "/dashboard", icon: Zap },
  { title: "Scripts", url: "/scripts", icon: Save },
  { title: "Pastebin", url: "/pastebin", icon: FileCode },
  { title: "Settings", url: "/script-settings", icon: Eye },
  { title: "AI", url: "/ai-assistant", icon: Bot },
  { title: "Prompt Vault", url: "/prompts", icon: Sparkles },
  { title: "Discord", url: "/discord-bot", icon: MessageSquare },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Protection Keys", url: "/protection-keys", icon: Key },
  { title: "Changelog", url: "/changelog", icon: History },
  { title: "Preferences", url: "/settings", icon: Settings },
];

const adminItems = [
  { title: "Admin Panel", url: "/admin", icon: Shield },
];

const resetTheme = () => {
  const root = document.documentElement;
  root.style.removeProperty('--foreground');
  root.style.removeProperty('--card-foreground');
  root.style.removeProperty('--popover-foreground');
  root.style.removeProperty('--sidebar-foreground');
  root.style.removeProperty('--neon-color');
  root.style.removeProperty('--neon-color-glow');
  root.classList.remove('neon-text-enabled');
  root.classList.remove('ult-lua-style-enabled');
};

const applyTheme = (color: string, neon: boolean, ultStyle: boolean) => {
  const root = document.documentElement;
  const [r, g, b] = color.split(',').map(c => parseInt(c.trim()));
  const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm), min = Math.min(rNorm, gNorm, bNorm);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm: h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6; break;
      case gNorm: h = ((bNorm - rNorm) / d + 2) / 6; break;
      case bNorm: h = ((rNorm - gNorm) / d + 4) / 6; break;
    }
  }
  // Clamp lightness so text stays readable on the cream/light background.
  const clampedL = Math.min(Math.round(l * 100), 22);
  const clampedS = Math.min(Math.round(s * 100), 40);
  const hsl = `${Math.round(h * 360)} ${clampedS}% ${clampedL}%`;
  root.style.setProperty('--foreground', hsl);
  root.style.setProperty('--card-foreground', hsl);
  root.style.setProperty('--popover-foreground', hsl);
  root.style.setProperty('--sidebar-foreground', hsl);
  if (neon) {
    root.style.setProperty('--neon-color', `rgb(${color})`);
    root.style.setProperty('--neon-color-glow', `rgba(${color}, 0.6)`);
    root.classList.add('neon-text-enabled');
  } else {
    root.style.removeProperty('--neon-color');
    root.style.removeProperty('--neon-color-glow');
    root.classList.remove('neon-text-enabled');
  }
  if (ultStyle) root.classList.add('ult-lua-style-enabled');
  else root.classList.remove('ult-lua-style-enabled');
};

const TopBar = ({ onLogout }: { onLogout: () => void }) => (
  <header className="sticky top-0 z-40 border-b border-border/40 bg-background/75 backdrop-blur-2xl">
    <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 lg:px-8">
      <NavLink to="/dashboard" className="flex items-center gap-2.5 shrink-0">
        <CloudLogo size={24} />
        <div className="leading-tight">
          <div className="text-[11px] font-black tracking-[0.22em] text-foreground">ULT CLOUD</div>
          <div className="text-[8px] tracking-[0.25em] text-muted-foreground/70">PROTECTION</div>
        </div>
      </NavLink>
      <div className="flex-1" />
      <SoundToggle />
      <Button
        variant="ghost"
        size="sm"
        onClick={onLogout}
        className="rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs gap-1.5"
      >
        <LogOut size={14} /> <span className="hidden sm:inline">Logout</span>
      </Button>
    </div>
  </header>
);

const BottomNav = ({ user }: { user: User | null }) => {
  const location = useLocation();
  const { isAdmin } = useAdminStatus(user?.id);
  const [moreOpen, setMoreOpen] = useState(false);
  const navItems = isAdmin ? [...navigationItems, ...adminItems] : navigationItems;

  const primary = navItems.slice(0, 4);
  const overflow = navItems.slice(4);
  const overflowActive = overflow.some((item) => item.url === location.pathname);

  const tabClass = (isActive: boolean) =>
    `flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-[10.5px] font-medium transition-all ${
      isActive
        ? "bg-foreground text-background shadow-[var(--shadow-soft)]"
        : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
    }`;

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/10 backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
          aria-hidden
        />
      )}

      <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-[900px]">
          {moreOpen && (
            <div className="mb-2 grid grid-cols-3 gap-2 rounded-3xl border border-border/60 bg-background/95 p-3 backdrop-blur-2xl shadow-[var(--shadow-soft)] sm:grid-cols-4">
              {overflow.map((item) => (
                <NavLink
                  key={item.title}
                  to={item.url}
                  end
                  onClick={() => setMoreOpen(false)}
                  className={tabClass(location.pathname === item.url)}
                >
                  <item.icon size={17} />
                  <span className="text-center leading-tight">{item.title}</span>
                </NavLink>
              ))}
            </div>
          )}

          <nav className="grid grid-cols-5 gap-1 rounded-3xl border border-border/60 bg-background/90 p-1.5 backdrop-blur-2xl shadow-[var(--shadow-soft)]">
            {primary.map((item) => (
              <NavLink
                key={item.title}
                to={item.url}
                end
                onClick={() => setMoreOpen(false)}
                className={tabClass(location.pathname === item.url)}
              >
                <item.icon size={17} />
                <span className="truncate max-w-full">{item.title}</span>
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={tabClass(overflowActive || moreOpen)}
              aria-label="More tabs"
              aria-expanded={moreOpen}
            >
              {moreOpen ? <X size={17} /> : <Menu size={17} />}
              <span>More</span>
            </button>
          </nav>
        </div>
      </div>
    </>
  );
};


const SoundToggle = () => {
  const [soundOn, setSoundOn] = useState(isSnowSoundOn());
  return (
    <Button variant="ghost" size="icon" onClick={() => setSoundOn(toggleSnowSound())} className="text-muted-foreground/70 hover:text-foreground h-9 w-9 rounded-full" title={soundOn ? "Mute" : "Unmute"}>
      {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
    </Button>
  );
};

interface DashboardLayoutProps { children: ReactNode; }

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const initializedRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  const handleLogout = async () => {
    resetTheme();
    try { await supabase.auth.signOut(); } catch (error) { console.log('Logout error:', error); }
    localStorage.removeItem('sb-iyfvpnjrghsownkpazec-auth-token');
    navigate("/auth");
  };

  useEffect(() => {
    const loadUserTheme = async (userId: string) => {
      resetTheme();
      try {
        const { data } = await supabase.from('user_themes')
          .select('primary_color, neon_enabled, ult_lua_style, layout_preset, tab_radius, tab_density, tab_shape')
          .eq('user_id', userId).single();
        if (data) {
          applyTheme(data.primary_color, data.neon_enabled || false, data.ult_lua_style || false);
          applyDashboardLayout(
            (data.layout_preset as LayoutPreset) || "default",
            data.tab_radius ?? 12,
            (data.tab_density as TabDensity) || "normal",
            (data.tab_shape as TabShape) || "pill",
          );
        }
      } catch (error) { console.error('Error loading theme:', error); }
    };

    const trackLogin = (userId: string) => {
      supabase.functions.invoke('track-ip', { body: { user_id: userId, action: 'login' } })
        .catch((error) => console.warn('IP tracking skipped:', error?.message));
    };

    const checkBanStatus = async (userId: string) => {
      try {
        const { data } = await supabase.functions.invoke('track-ip', { body: { user_id: userId, action: 'check_ban' } });
        if (data?.banned) {
          resetTheme();
          await supabase.auth.signOut();
          localStorage.removeItem('sb-iyfvpnjrghsownkpazec-auth-token');
          navigate("/auth", { state: { banReason: data.reason || 'Your account has been banned.' } });
        }
      } catch (err) { console.warn('Ban check skipped:', err); }
    };

    const safeSetUser = (sessionUser: User) => {
      if (userIdRef.current !== sessionUser.id) { userIdRef.current = sessionUser.id; setUser(sessionUser); }
    };

    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (!session) { resetTheme(); navigate("/auth"); }
      else {
        safeSetUser(session.user);
        if (!initializedRef.current) {
          initializedRef.current = true;
          loadUserTheme(session.user.id);
          trackLogin(session.user.id);
          checkBanStatus(session.user.id);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (!session) { resetTheme(); userIdRef.current = null; navigate("/auth"); }
      else {
        safeSetUser(session.user);
        if (event === 'SIGNED_IN' && !initializedRef.current) {
          initializedRef.current = true;
          loadUserTheme(session.user.id);
          trackLogin(session.user.id);
          checkBanStatus(session.user.id);
        }
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  return (
    <div className="min-h-screen w-full bg-background overflow-x-hidden relative flex flex-col">
      <CloudBackground />
      <SnowEffect />
      <TopBar onLogout={handleLogout} />
      <main className="flex-1 overflow-x-hidden overflow-y-auto relative z-10">
        <div className="mx-auto max-w-[1400px] p-4 pb-32 sm:p-6 sm:pb-32 lg:p-8 lg:pb-36">
          {children}
        </div>
      </main>
      <BottomNav user={user} />
    </div>
  );
};

export default DashboardLayout;
