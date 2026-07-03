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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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

export type NavPosition = "top" | "bottom" | "left" | "right";
const NAV_POS_KEY = "ult:navPosition";

export const getNavPosition = (): NavPosition => {
  if (typeof window === "undefined") return "top";
  const v = localStorage.getItem(NAV_POS_KEY) as NavPosition | null;
  return v === "bottom" || v === "left" || v === "right" || v === "top" ? v : "top";
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
    <Button variant="ghost" size="icon" onClick={() => setSoundOn(toggleSnowSound())} className="text-muted-foreground/70 hover:text-foreground h-9 w-9 rounded-full" title={soundOn ? "Mute" : "Unmute"}>
      {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
    </Button>
  );
};

const NavItemLink = ({ item, active, onClick, compact = false }: { item: typeof navigationItems[0]; active: boolean; onClick?: () => void; compact?: boolean }) => (
  <NavLink
    to={item.url}
    end
    onClick={onClick}
    className={`group flex items-center gap-1.5 rounded-lg px-3 ${compact ? "py-1.5" : "py-2"} text-[12.5px] font-medium whitespace-nowrap transition-all ${
      active
        ? "bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_hsl(272_92%_55%/0.55)]"
        : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
    }`}
  >
    <item.icon size={14} />
    <span>{item.title}</span>
  </NavLink>
);

const HorizontalBar = ({
  position, user, onLogout, items,
}: { position: "top" | "bottom"; user: User | null; onLogout: () => void; items: typeof navigationItems }) => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const isBottom = position === "bottom";
  const primary = isBottom ? items.slice(0, 4) : items;
  const overflow = isBottom ? items.slice(4) : [];

  if (isBottom) {
    return (
      <>
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-2xl pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto max-w-[720px] grid grid-cols-5 gap-1 px-2 py-1.5">
            {primary.map((item) => {
              const active = location.pathname === item.url;
              return (
                <NavLink
                  key={item.title}
                  to={item.url}
                  end
                  className="flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 min-w-0 group"
                >
                  <div
                    className={`flex items-center justify-center h-8 w-11 rounded-lg transition-all ${
                      active
                        ? "bg-primary/20 text-primary shadow-[0_0_18px_-4px_hsl(272_92%_60%/0.6)]"
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    <item.icon size={18} strokeWidth={active ? 2.4 : 2} />
                  </div>
                  <span
                    className={`text-[9.5px] leading-none truncate max-w-full font-medium ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {item.title}
                  </span>
                </NavLink>
              );
            })}
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 min-w-0 group"
            >
              <div className="flex items-center justify-center h-8 w-11 rounded-lg text-muted-foreground group-hover:text-foreground">
                <MoreHorizontal size={18} />
              </div>
              <span className="text-[9.5px] leading-none font-medium text-muted-foreground">More</span>
            </button>
          </div>
        </nav>

        {moreOpen && (
          <div className="fixed inset-0 z-50 flex items-end animate-fade-in" onClick={() => setMoreOpen(false)}>
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
            <div
              className="relative w-full bg-background/98 backdrop-blur-2xl border-t border-primary/20 rounded-t-3xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] max-h-[85vh] overflow-y-auto animate-slide-in-right"
              style={{ animation: "fade-in 0.2s ease-out" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto w-10 h-1 rounded-full bg-muted mb-4" />
              <div className="mb-4">
                <div className="text-lg font-bold">More</div>
                <div className="text-xs text-muted-foreground">All routes and account actions.</div>
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
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border/60 bg-card/60 text-foreground hover:border-primary/30 hover:bg-primary/5"
                      }`}
                    >
                      <item.icon size={18} />
                      <span className="text-[10.5px] font-medium text-center leading-tight">{item.title}</span>
                    </NavLink>
                  );
                })}
              </div>
              <button
                onClick={() => { setMoreOpen(false); onLogout(); }}
                className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm text-destructive bg-destructive/10 hover:bg-destructive/15 border border-destructive/20"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <header className="sticky top-0 border-b z-40 border-border/40 bg-background/80 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 lg:px-8">
        <NavLink to="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <CloudLogo size={28} />
          <div className="hidden sm:block leading-tight">
            <div className="text-[11px] font-black tracking-[0.22em] text-foreground">ULT CLOUD</div>
            <div className="text-[8px] tracking-[0.25em] text-muted-foreground/70">PROTECTION</div>
          </div>
        </NavLink>
        <nav className="hidden lg:flex items-center gap-1 ml-4 flex-1 overflow-x-auto">
          {items.map((item) => (
            <NavItemLink key={item.title} item={item} active={location.pathname === item.url} />
          ))}
        </nav>
        <div className="flex-1 lg:flex-none" />
        <SoundToggle />
        <Button variant="ghost" size="sm" onClick={onLogout} className="hidden md:inline-flex rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs gap-1.5">
          <LogOut size={14} /> Logout
        </Button>
        <Button variant="ghost" size="icon" className="lg:hidden rounded-full h-9 w-9" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </Button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-border/40 bg-background/95 backdrop-blur-2xl">
          <div className="max-w-[1400px] mx-auto px-4 py-3 grid grid-cols-2 gap-2">
            {items.map((item) => (
              <NavLink key={item.title} to={item.url} end onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-all ${
                  location.pathname === item.url ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-primary/10"
                }`}>
                <item.icon size={15} />
                <span>{item.title}</span>
              </NavLink>
            ))}
            <button onClick={() => { setMobileOpen(false); onLogout(); }}
              className="col-span-2 mt-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm text-destructive bg-destructive/10 hover:bg-destructive/15">
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

const SideRail = ({
  position, onLogout, items,
}: { position: "left" | "right"; onLogout: () => void; items: typeof navigationItems }) => {
  const location = useLocation();
  const isRight = position === "right";
  return (
    <aside className={`hidden lg:flex fixed top-0 ${isRight ? "right-0 border-l" : "left-0 border-r"} bottom-0 z-40 w-60 flex-col border-border/40 bg-background/85 backdrop-blur-2xl`}>
      <div className="p-4 border-b border-border/40">
        <NavLink to="/dashboard" className="flex items-center gap-2.5">
          <CloudLogo size={30} />
          <div className="leading-tight">
            <div className="text-[11px] font-black tracking-[0.22em] text-foreground">ULT CLOUD</div>
            <div className="text-[8px] tracking-[0.25em] text-muted-foreground/70">PROTECTION</div>
          </div>
        </NavLink>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.map((item) => {
          const active = location.pathname === item.url;
          return (
            <NavLink key={item.title} to={item.url} end
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
                active ? "bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_hsl(272_92%_55%/0.55)]" : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
              }`}>
              <item.icon size={15} />
              <span>{item.title}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="p-2 border-t border-border/40 flex items-center justify-between">
        <SoundToggle />
        <Button variant="ghost" size="sm" onClick={onLogout} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs gap-1.5 rounded-full">
          <LogOut size={14} /> Logout
        </Button>
      </div>
    </aside>
  );
};

interface DashboardLayoutProps { children: ReactNode; }

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [navPos, setNavPos] = useState<NavPosition>(getNavPosition());
  const navigate = useNavigate();
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

  const isSide = navPos === "left" || navPos === "right";
  const mainPadding = navPos === "bottom" ? "pb-24" : "";
  const sidePadding = navPos === "left" ? "lg:pl-60" : navPos === "right" ? "lg:pr-60" : "";

  return (
    <div className="min-h-screen w-full bg-background overflow-x-hidden relative flex flex-col">
      <CloudBackground />
      <SnowEffect />

      {navPos === "top" && <HorizontalBar position="top" user={user} onLogout={handleLogout} items={items} />}
      {isSide && <SideRail position={navPos as "left" | "right"} onLogout={handleLogout} items={items} />}

      <main className={`flex-1 overflow-x-hidden overflow-y-auto relative z-10 ${mainPadding} ${sidePadding}`}>
        <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>

      {navPos === "bottom" && <HorizontalBar position="bottom" user={user} onLogout={handleLogout} items={items} />}
    </div>
  );
};

export default DashboardLayout;
