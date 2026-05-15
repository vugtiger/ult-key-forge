import { ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { Zap, Save, Bot, Settings, LogOut, FileCode, Shield, MessageSquare, BarChart3, History, Eye, Volume2, VolumeX, Key } from "lucide-react";
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
  const hsl = `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
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

const AppSidebar = ({ user }: { user: User | null }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const { isAdmin } = useAdminStatus(user?.id);

  const handleLogout = async () => {
    resetTheme();
    try { await supabase.auth.signOut(); } catch (error) { console.log('Logout error:', error); }
    localStorage.removeItem('sb-iyfvpnjrghsownkpazec-auth-token');
    navigate("/auth");
  };

  const navItems = isAdmin ? [...navigationItems, ...adminItems] : navigationItems;
  const collapsed = state === "collapsed";

  return (
    <Sidebar className={collapsed ? "w-[60px]" : "w-[220px]"} collapsible="icon">
      <SidebarContent className="bg-background/80 backdrop-blur-3xl border-r border-border/40 relative flex flex-col">
        {/* Brand */}
        <div className={`flex items-center gap-3 border-b border-border/30 ${collapsed ? "px-2 py-4 justify-center" : "px-5 py-5"}`}>
          <CloudLogo size={collapsed ? 24 : 22} />
          {!collapsed && (
            <div>
              <h1 className="text-xs font-black tracking-[0.25em] text-foreground">ULT CLOUD</h1>
              <p className="text-[9px] text-muted-foreground/50 tracking-wider mt-0.5">PROTECTION</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <SidebarGroup className="flex-1 mt-3 px-2">
          <SidebarGroupLabel className={`text-[9px] tracking-[0.3em] text-muted-foreground/40 uppercase mb-2 ${collapsed ? "sr-only" : "px-3"}`}>
            {isAdmin ? "Owner" : "Navigation"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {navItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-all duration-150 ${
                          isActive
                            ? "bg-gradient-to-b from-foreground/[0.13] to-foreground/[0.06] text-foreground shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.18),inset_0_-1px_0_0_hsl(0_0%_0%/0.4),0_2px_6px_-2px_hsl(0_0%_0%/0.6),0_1px_0_0_hsl(0_0%_0%/0.3)] -translate-y-px"
                            : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] hover:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] active:translate-y-px"
                        }`}
                        activeClassName=""
                      >
                        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-foreground shadow-[0_0_8px_hsl(var(--foreground)/0.5)]" />}
                        <item.icon size={16} className={isActive ? "text-foreground drop-shadow-[0_1px_1px_hsl(0_0%_0%/0.5)]" : "text-muted-foreground/70 group-hover:text-foreground"} />
                        {!collapsed && <span className={isActive ? "font-semibold" : "font-medium"}>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Logout */}
        <div className="p-2 border-t border-border/30 mt-auto">
          <Button
            variant="ghost"
            className={`w-full rounded-xl px-3 py-2.5 text-[13px] text-muted-foreground/70 hover:text-foreground hover:bg-destructive/[0.08] transition-all ${collapsed ? "justify-center" : "justify-start"}`}
            onClick={handleLogout}
          >
            <LogOut size={16} className={collapsed ? "" : "mr-3"} />
            {!collapsed && <span className="font-medium">Logout</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
};

const SoundToggle = () => {
  const [soundOn, setSoundOn] = useState(isSnowSoundOn());
  return (
    <Button variant="ghost" size="icon" onClick={() => setSoundOn(toggleSnowSound())} className="text-muted-foreground/50 hover:text-foreground h-8 w-8 rounded-lg" title={soundOn ? "Mute" : "Unmute"}>
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

  useEffect(() => {
    const loadUserTheme = async (userId: string) => {
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
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-x-hidden relative">
        <CloudBackground />
        <SnowEffect />
        <AppSidebar user={user} />
        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          <header className="h-14 border-b border-border/30 flex items-center px-6 sticky top-0 bg-background/50 backdrop-blur-3xl z-10">
            <SidebarTrigger className="mr-4 h-8 w-8 rounded-lg hover:bg-foreground/[0.06]" />
            <div className="flex-1" />
            <SoundToggle />
          </header>
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
