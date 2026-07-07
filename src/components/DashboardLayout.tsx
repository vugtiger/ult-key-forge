import { ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

import { NavLink } from "@/components/NavLink";
import { Zap, Save, Bot, Settings, LogOut, FileCode, Shield, MessageSquare, BarChart3, History, Eye, Volume2, VolumeX, Key, Sparkles, Menu, X, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import CloudLogo from "@/components/CloudLogo";
import CloudBackground from "@/components/CloudBackground";
import SnowEffect, { toggleSnowSound, isSnowSoundOn } from "@/components/SnowEffect";
import { applyDashboardLayout, LayoutPreset, TabDensity, TabShape } from "@/components/DashboardCustomizer";

type NavItem = { title: string; url: string; icon: typeof Zap; section: "main" | "manage" | "system" };

const navigationItems: NavItem[] = [
  { title: "Key System", url: "/dashboard", icon: Zap, section: "main" },
  { title: "Scripts", url: "/scripts", icon: Save, section: "main" },
  { title: "Pastebin", url: "/pastebin", icon: FileCode, section: "main" },
  { title: "Settings", url: "/script-settings", icon: Eye, section: "main" },
  { title: "AI", url: "/ai-assistant", icon: Bot, section: "manage" },
  { title: "Prompt Vault", url: "/prompts", icon: Sparkles, section: "manage" },
  { title: "Discord", url: "/discord-bot", icon: MessageSquare, section: "manage" },
  { title: "Analytics", url: "/analytics", icon: BarChart3, section: "manage" },
  { title: "Protection Keys", url: "/protection-keys", icon: Key, section: "manage" },
  { title: "Changelog", url: "/changelog", icon: History, section: "system" },
  { title: "Preferences", url: "/settings", icon: Settings, section: "system" },
];

const adminItems: NavItem[] = [
  { title: "Admin Panel", url: "/admin", icon: Shield, section: "system" },
];

export type NavPosition = "top" | "bottom" | "left" | "right";
const NAV_POS_KEY = "ult:navPosition";

export const getNavPosition = (): NavPosition => {
  if (typeof window === "undefined") return "left";
  const v = localStorage.getItem(NAV_POS_KEY) as NavPosition | null;
  return v === "bottom" || v === "left" || v === "right" || v === "top" ? v : "left";
};

export const setNavPosition = (pos: NavPosition) => {
  localStorage.setItem(NAV_POS_KEY, pos);
  window.dispatchEvent(new CustomEvent("ult:navPosition", { detail: pos }));
};

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

const SoundToggle = () => {
  const [soundOn, setSoundOn] = useState(isSnowSoundOn());
  return (
    <button
      onClick={() => setSoundOn(toggleSnowSound())}
      className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
      title={soundOn ? "Mute" : "Unmute"}
    >
      {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
    </button>
  );
};

const SECTION_LABELS: Record<NavItem["section"], string> = {
  main: "SELL",
  manage: "MANAGE",
  system: "SYSTEM",
};

const SidebarNav = ({
  items,
  user,
  onLogout,
  onNavigate,
}: {
  items: NavItem[];
  user: User | null;
  onLogout: () => void;
  onNavigate?: () => void;
}) => {
  const location = useLocation();
  const sections: NavItem["section"][] = ["main", "manage", "system"];

  return (
    <div className="h-full flex flex-col rounded-2xl border border-border/50 bg-[hsl(262_35%_7%/0.85)] backdrop-blur-2xl shadow-[0_10px_40px_-10px_hsl(272_92%_20%/0.6)] overflow-hidden">
      {/* Brand */}
      <div className="px-4 pt-5 pb-4">
        <NavLink to="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5">
          <CloudLogo size={26} />
          <div className="text-[16px] font-bold tracking-tight text-foreground">ULT Cloud</div>
        </NavLink>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-4 [scrollbar-width:thin]">
        {sections.map((section) => {
          const sectionItems = items.filter((i) => i.section === section);
          if (sectionItems.length === 0) return null;
          return (
            <div key={section}>
              <div className="px-3 pb-1.5 text-[10px] font-semibold tracking-[0.22em] text-muted-foreground/50">
                {SECTION_LABELS[section]}
              </div>
              <div className="space-y-0.5">
                {sectionItems.map((item) => {
                  const active = location.pathname === item.url;
                  return (
                    <NavLink
                      key={item.title}
                      to={item.url}
                      end
                      onClick={onNavigate}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200 ${
                        active
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      }`}
                    >
                      <item.icon size={16} className={active ? "text-primary" : "text-muted-foreground group-hover:text-primary"} />
                      <span>{item.title}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer: user + logout */}
      <div className="px-2 pb-3 pt-2 border-t border-border/30 space-y-1">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-primary/90 hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
        {user?.email && (
          <div className="mt-2 rounded-xl border border-border/40 bg-card/50 px-3 py-2.5 flex items-center justify-between gap-2">
            <span className="text-[12px] text-muted-foreground truncate">{user.email}</span>
            <SoundToggle />
          </div>
        )}
      </div>
    </div>
  );
};

const BottomTabs = ({
  items,
  user,
  onLogout,
}: {
  items: NavItem[];
  user: User | null;
  onLogout: () => void;
}) => {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = items.slice(0, 4);
  const overflow = items.slice(4);
  const activeInOverflow = overflow.some((i) => i.url === location.pathname);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/40 bg-[hsl(262_35%_6%/0.92)] backdrop-blur-2xl pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-[720px] grid grid-cols-5 gap-1 px-2 py-2">
          {primary.map((item) => {
            const active = location.pathname === item.url;
            return (
              <NavLink
                key={item.title}
                to={item.url}
                end
                className="flex flex-col items-center justify-center gap-1 py-1 min-w-0 group transition-transform active:scale-95"
              >
                <div
                  className={`flex items-center justify-center h-9 w-11 rounded-xl transition-all duration-300 ${
                    active
                      ? "bg-primary/20 text-primary shadow-[0_0_20px_-4px_hsl(272_92%_60%/0.7)]"
                      : "text-muted-foreground group-hover:text-primary"
                  }`}
                >
                  <item.icon size={18} strokeWidth={active ? 2.4 : 2} />
                </div>
                <span className={`text-[10px] leading-none truncate max-w-full font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
                  {item.title}
                </span>
              </NavLink>
            );
          })}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="flex flex-col items-center justify-center gap-1 py-1 min-w-0 group transition-transform active:scale-95"
          >
            <div className={`flex items-center justify-center h-9 w-11 rounded-xl transition-all duration-300 ${
              moreOpen || activeInOverflow
                ? "bg-primary/20 text-primary shadow-[0_0_20px_-4px_hsl(272_92%_60%/0.7)]"
                : "text-muted-foreground group-hover:text-primary"
            }`}>
              <MoreHorizontal size={18} />
            </div>
            <span className={`text-[10px] leading-none font-medium ${moreOpen || activeInOverflow ? "text-primary" : "text-muted-foreground"}`}>More</span>
          </button>
        </div>
      </nav>

      {/* More popover — sits ABOVE the bottom bar, does not cover it */}
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="fixed left-2 right-2 z-50 rounded-2xl border border-primary/25 bg-[hsl(262_35%_7%/0.98)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_hsl(272_92%_20%/0.7)] p-3 animate-fade-in"
            style={{
              bottom: `calc(env(safe-area-inset-bottom) + 76px)`,
              maxHeight: "60vh",
              overflowY: "auto",
            }}
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <div className="text-[13px] font-semibold text-foreground">More</div>
              <button onClick={() => setMoreOpen(false)} className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10">
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {overflow.map((item) => {
                const active = location.pathname === item.url;
                return (
                  <NavLink
                    key={item.title}
                    to={item.url}
                    end
                    onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl p-3 border transition-all ${
                      active
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border/40 bg-card/40 text-foreground hover:border-primary/30 hover:bg-primary/8"
                    }`}
                  >
                    <item.icon size={18} className={active ? "text-primary" : "text-muted-foreground"} />
                    <span className="text-[10.5px] font-medium text-center leading-tight">{item.title}</span>
                  </NavLink>
                );
              })}
            </div>
            <button
              onClick={() => { setMoreOpen(false); onLogout(); }}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-medium text-primary bg-primary/10 hover:bg-primary/15 border border-primary/25"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </>
      )}
    </>
  );
};

interface DashboardLayoutProps { children: ReactNode; }

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [navPos, setNavPos] = useState<NavPosition>(getNavPosition());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const initializedRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const { isAdmin } = useAdminStatus(user?.id);
  const items = isAdmin ? [...navigationItems, ...adminItems] : navigationItems;

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<NavPosition>).detail;
      if (detail) setNavPos(detail);
    };
    window.addEventListener("ult:navPosition", handler);
    return () => window.removeEventListener("ult:navPosition", handler);
  }, []);

  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

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

  const useBottom = navPos === "bottom";
  const sideOnRight = navPos === "right";
  const useSide = !useBottom;
  const sidePadding = useBottom
    ? ""
    : sideOnRight
      ? "lg:pr-[248px] pr-0"
      : "lg:pl-[248px] pl-0";
  const bottomPadding = useBottom ? "pb-24" : "";

  return (
    <div className="min-h-screen w-full bg-background overflow-x-hidden relative">
      <CloudBackground />
      <SnowEffect />

      {/* Floating sidebar — always visible on lg+ */}
      {useSide && (
        <aside className={`hidden lg:flex fixed top-3 bottom-3 z-40 w-[232px] ${sideOnRight ? "right-3" : "left-3"}`}>
          <SidebarNav items={items} user={user} onLogout={handleLogout} />
        </aside>
      )}

      {/* Mobile top bar - always shown for logo visibility */}
      <header className="lg:hidden sticky top-0 z-30 flex h-14 items-center justify-between px-4 border-b border-border/40 bg-[hsl(262_35%_6%/0.9)] backdrop-blur-2xl">
        <NavLink to="/dashboard" className="flex items-center gap-2.5">
          <CloudLogo size={24} />
          <div className="text-[13px] font-bold tracking-tight">ULT Cloud</div>
        </NavLink>
        {useSide && (
          <button
            onClick={() => setMobileNavOpen(true)}
            className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
        )}
      </header>

      {/* Mobile floating drawer */}
      {useSide && mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50" onClick={() => setMobileNavOpen(false)}>
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm animate-fade-in" />
          <div
            className="absolute top-3 bottom-3 left-3 w-[260px] animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarNav items={items} user={user} onLogout={handleLogout} onNavigate={() => setMobileNavOpen(false)} />
            <button
              onClick={() => setMobileNavOpen(false)}
              className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <main className={`relative z-10 ${sidePadding} ${bottomPadding} transition-[padding] duration-300`}>
        <div key={location.pathname} className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8 animate-fade-in">
          {children}
        </div>
      </main>

      {useBottom && <BottomTabs items={items} user={user} onLogout={handleLogout} />}
    </div>
  );
};

export default DashboardLayout;
