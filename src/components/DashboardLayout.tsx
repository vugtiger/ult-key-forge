import { ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { Zap, Save, Bot, Settings, LogOut, FileCode, Shield, MessageSquare, BarChart3, History, Eye, Volume2, VolumeX, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import CloudLogo from "@/components/CloudLogo";
import CloudBackground from "@/components/CloudBackground";
import SnowEffect, { toggleSnowSound, isSnowSoundOn } from "@/components/SnowEffect";

const navigationItems = [
  { title: "Key System", url: "/dashboard", icon: Zap, color: "text-violet-400" },
  { title: "Script Storage", url: "/scripts", icon: Save, color: "text-blue-400" },
  { title: "Pastebin", url: "/pastebin", icon: FileCode, color: "text-cyan-400" },
  { title: "Script Settings", url: "/script-settings", icon: Eye, color: "text-emerald-400" },
  { title: "AI Assistant", url: "/ai-assistant", icon: Bot, color: "text-pink-400" },
  { title: "Discord Bot", url: "/discord-bot", icon: MessageSquare, color: "text-indigo-400" },
  { title: "Analytics", url: "/analytics", icon: BarChart3, color: "text-amber-400" },
  { title: "Changelog", url: "/changelog", icon: History, color: "text-teal-400" },
  { title: "Settings", url: "/settings", icon: Settings, color: "text-slate-400" },
];

const adminItems = [
  { title: "Admin Panel", url: "/admin", icon: Shield, color: "text-red-400" },
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

  const navItems = isAdmin ? adminItems : navigationItems;

  return (
    <Sidebar className={state === "collapsed" ? "w-[60px]" : "w-[220px]"} collapsible="icon">
      <SidebarContent className="bg-background/60 backdrop-blur-2xl border-r border-primary/5 relative overflow-hidden">
        {/* Gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        
        {/* Logo area */}
        <div className="px-3 py-4 flex items-center gap-2.5">
          {state !== "collapsed" ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center border border-primary/20">
                <CloudLogo size={18} className="text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold tracking-[0.15em] text-foreground/90">ULT CLOUD</span>
                <span className="text-[9px] text-primary/60 tracking-wider">PROTECTION</span>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center mx-auto border border-primary/20">
              <CloudLogo size={18} className="text-primary" />
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-3 h-[1px] bg-gradient-to-r from-transparent via-primary/10 to-transparent" />

        {/* Navigation */}
        <SidebarGroup className="mt-1 flex-1">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5 px-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className={`group relative rounded-lg px-2.5 py-2 text-sm transition-all duration-200 flex items-center gap-2.5 ${
                          isActive 
                            ? 'bg-primary/10 text-foreground' 
                            : 'text-muted-foreground hover:text-foreground hover:bg-primary/5'
                        }`}
                        activeClassName=""
                      >
                        {/* Active indicator bar */}
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
                        )}
                        <item.icon className={`${state === "collapsed" ? "" : ""} ${isActive ? 'text-primary' : item.color} transition-colors`} size={16} />
                        {state !== "collapsed" && (
                          <span className="text-[12px] font-medium">{item.title}</span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Bottom section */}
        <div className="px-2 pb-3 space-y-1">
          <div className="mx-1 h-[1px] bg-gradient-to-r from-transparent via-primary/10 to-transparent mb-2" />
          <Button 
            variant="ghost" 
            className="w-full justify-start rounded-lg px-2.5 py-2 text-sm text-muted-foreground/70 hover:text-destructive hover:bg-destructive/8 transition-all" 
            onClick={handleLogout}
          >
            <LogOut className={state === "collapsed" ? "" : "mr-2.5"} size={15} />
            {state !== "collapsed" && <span className="text-[12px]">Sign Out</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
};

const SoundToggle = () => {
  const [soundOn, setSoundOn] = useState(isSnowSoundOn());
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={() => setSoundOn(toggleSnowSound())} 
      className="text-muted-foreground/50 hover:text-foreground h-7 w-7 rounded-full hover:bg-primary/8" 
      title={soundOn ? "Mute snow sound" : "Unmute snow sound"}
    >
      {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
    </Button>
  );
};

interface DashboardLayoutProps { children: ReactNode; }

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const initializedRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  // Get current page title
  const getPageTitle = () => {
    const item = navigationItems.find(i => i.url === location.pathname) || adminItems.find(i => i.url === location.pathname);
    return item?.title || 'Dashboard';
  };

  useEffect(() => {
    const loadUserTheme = async (userId: string) => {
      try {
        const { data } = await supabase.from('user_themes').select('primary_color, neon_enabled, ult_lua_style').eq('user_id', userId).single();
        if (data) applyTheme(data.primary_color, data.neon_enabled || false, data.ult_lua_style || false);
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
          {/* Redesigned header - minimal floating bar */}
          <header className="sticky top-0 z-10">
            <div className="h-14 flex items-center px-6 bg-background/40 backdrop-blur-xl border-b border-primary/5">
              <SidebarTrigger className="mr-4 h-7 w-7 text-muted-foreground/60 hover:text-foreground" />
              
              {/* Page title with accent */}
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-primary/50" />
                <h2 className="text-sm font-semibold tracking-wide text-foreground/80">{getPageTitle()}</h2>
              </div>
              
              <div className="flex-1" />
              
              {/* Status indicator */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-emerald-400 font-medium">LIVE</span>
                </div>
                <SoundToggle />
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
