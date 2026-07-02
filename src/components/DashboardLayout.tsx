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
  // Clamp lightness so text stays readable on the dark navy background.
  const clampedL = Math.max(Math.round(l * 100), 85);
  const clampedS = Math.min(Math.round(s * 100), 30);
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

const TopNav = ({ user, onLogout }: { user: User | null; onLogout: () => void }) => {
  const location = useLocation();
  const { isAdmin } = useAdminStatus(user?.id);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = isAdmin ? [...navigationItems, ...adminItems] : navigationItems;

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/75 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 lg:px-8">
        <NavLink to="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <CloudLogo size={26} />
          <div className="hidden sm:block leading-tight">
            <div className="text-[11px] font-black tracking-[0.22em] text-foreground">ULT CLOUD</div>
            <div className="text-[8px] tracking-[0.25em] text-muted-foreground/70">PROTECTION</div>
          </div>
        </NavLink>

        <nav className="hidden lg:flex items-center gap-1 ml-4 flex-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <NavLink
                key={item.title}
                to={item.url}
                end
                className={`group flex items-center gap-1.5 rounded-md px-3 py-2 text-[12.5px] font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_hsl(45_95%_55%/0.45)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
                }`}
              >
                <item.icon size={14} />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="flex-1 lg:flex-none" />

        <SoundToggle />
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="hidden md:inline-flex rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs gap-1.5"
        >
          <LogOut size={14} /> Logout
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden rounded-full h-9 w-9"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </Button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-border/40 bg-background/95 backdrop-blur-2xl">
          <div className="max-w-[1400px] mx-auto px-4 py-3 grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.url;
              return (
                <NavLink
                  key={item.title}
                  to={item.url}
                  end
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-all ${
                    isActive ? "bg-foreground text-background" : "text-foreground/80 hover:bg-foreground/[0.06]"
                  }`}
                >
                  <item.icon size={15} />
                  <span>{item.title}</span>
                </NavLink>
              );
            })}
            <button
              onClick={() => { setMobileOpen(false); onLogout(); }}
              className="col-span-2 mt-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm text-destructive bg-destructive/10 hover:bg-destructive/15"
            >
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>
      )}
    </header>
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
      <TopNav user={user} onLogout={handleLogout} />
      <main className="flex-1 overflow-x-hidden overflow-y-auto relative z-10">
        <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
