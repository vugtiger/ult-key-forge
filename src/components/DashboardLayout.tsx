import { ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { Zap, Save, Bot, Settings, LogOut, FileCode, Shield, MessageSquare, BarChart3, History, Eye, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import CloudLogo from "@/components/CloudLogo";
import CloudBackground from "@/components/CloudBackground";
import SnowEffect, { toggleSnowSound, isSnowSoundOn } from "@/components/SnowEffect";


const navigationItems = [
  { title: "Key System Gen", url: "/dashboard", icon: Zap },
  { title: "Script Storage", url: "/scripts", icon: Save },
  { title: "Pastebin", url: "/pastebin", icon: FileCode },
  { title: "Script Settings", url: "/script-settings", icon: Eye },
  { title: "AI Assistant", url: "/ai-assistant", icon: Bot },
  { title: "Discord Bot", url: "/discord-bot", icon: MessageSquare },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Changelog", url: "/changelog", icon: History },
  { title: "Settings", url: "/settings", icon: Settings },
];

const adminItems = [
  { title: "Admin Panel", url: "/admin", icon: Shield },
];

// Reset theme to default
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

// Apply theme from user settings
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
  
  if (ultStyle) {
    root.classList.add('ult-lua-style-enabled');
  } else {
    root.classList.remove('ult-lua-style-enabled');
  }
};

const AppSidebar = ({ user }: { user: User | null }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const { isAdmin } = useAdminStatus(user?.id);

  const handleLogout = async () => {
    resetTheme();
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.log('Logout error (session may already be expired):', error);
    }
    localStorage.removeItem('sb-iyfvpnjrghsownkpazec-auth-token');
    navigate("/auth");
  };

  // Admin accounts only see Admin Panel
  const navItems = isAdmin ? adminItems : navigationItems;

  return (
    <Sidebar className={state === "collapsed" ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent className="bg-sidebar border-r border-sidebar-border">
        <div className="p-4 border-b border-sidebar-border flex items-center gap-3">
          {state !== "collapsed" ? (
            <>
              <CloudLogo size={28} className="text-foreground" />
              <h1 className="text-lg font-bold tracking-wider">
                ULT <span className="text-primary cloud-glow-text">CLOUD</span>
              </h1>
            </>
          ) : (
            <CloudLogo size={24} className="text-foreground" />
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className={state === "collapsed" ? "sr-only" : ""}>
            {isAdmin ? "Owner" : "Main Menu"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className={state === "collapsed" ? "" : "mr-2"} size={20} />
                      {state !== "collapsed" && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-4 border-t border-sidebar-border">
          <Button variant="ghost" className="w-full justify-start hover:bg-sidebar-accent" onClick={handleLogout}>
            <LogOut className={state === "collapsed" ? "" : "mr-2"} size={20} />
            {state !== "collapsed" && <span>Logout</span>}
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
      className="text-muted-foreground hover:text-foreground"
      title={soundOn ? "Mute snow sound" : "Unmute snow sound"}
    >
      {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
    </Button>
  );
};

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const initializedRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  

  useEffect(() => {
    const loadUserTheme = async (userId: string) => {
      try {
        const { data } = await supabase.from('user_themes').select('primary_color, neon_enabled, ult_lua_style').eq('user_id', userId).single();
        if (data) {
          applyTheme(data.primary_color, data.neon_enabled || false, data.ult_lua_style || false);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };

    const trackLogin = (userId: string) => {
      supabase.functions.invoke('track-ip', { body: { user_id: userId, action: 'login' } })
        .catch((error) => console.warn('IP tracking skipped:', error?.message));
    };

    const checkBanStatus = async (userId: string) => {
      try {
        const { data } = await supabase.functions.invoke('track-ip', {
          body: { user_id: userId, action: 'check_ban' }
        });
        if (data?.banned) {
          resetTheme();
          await supabase.auth.signOut();
          localStorage.removeItem('sb-iyfvpnjrghsownkpazec-auth-token');
          navigate("/auth", { state: { banReason: data.reason || 'Your account has been banned.' } });
        }
      } catch (err) {
        console.warn('Ban check skipped:', err);
      }
    };

    // Admin redirect removed — admin page is fully standalone

    const safeSetUser = (sessionUser: User) => {
      if (userIdRef.current !== sessionUser.id) {
        userIdRef.current = sessionUser.id;
        setUser(sessionUser);
      }
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

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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
          <header className="h-14 border-b border-border/30 flex items-center px-6 sticky top-0 bg-background/60 backdrop-blur-xl z-10">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1" />
            <SoundToggle />
          </header>
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
            {children}
          </main>
        </div>
        <JarvisVoice />
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
