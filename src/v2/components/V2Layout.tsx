import { ReactNode, useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, FolderKanban, FileCode2, Key, Users, Ban, Activity, Webhook, Settings, LogOut } from "lucide-react";
import { v2SignOut } from "../lib/v2Auth";
import "../styles/v2.css";

const navItems = [
  { to: "/v2/dashboard", label: "Projects", icon: FolderKanban },
  { to: "/v2/scripts", label: "Scripts", icon: FileCode2 },
  { to: "/v2/keys", label: "Keys", icon: Key },
  { to: "/v2/users", label: "Users", icon: Users },
  { to: "/v2/blacklist", label: "Blacklist", icon: Ban },
  { to: "/v2/logs", label: "Logs", icon: Activity },
  { to: "/v2/webhooks", label: "Webhooks", icon: Webhook },
  { to: "/v2/settings", label: "Settings", icon: Settings },
];

const V2Layout = ({ children, title }: { children: ReactNode; title?: string }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate("/v2/auth"); return; }
      const { data: profile } = await supabase.from("v2_profiles").select("id").eq("id", session.user.id).maybeSingle();
      if (!profile) { await supabase.auth.signOut(); navigate("/v2/auth"); return; }
      setEmail(session.user.email || "");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate("/v2/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await v2SignOut();
    navigate("/v2");
  };

  return (
    <div className="v2-root flex">
      {/* Sidebar */}
      <aside className="w-60 border-r flex flex-col h-screen sticky top-0" style={{ borderColor: "hsl(var(--v2-border))", background: "hsl(var(--v2-bg-elev))" }}>
        <div className="px-5 h-16 flex items-center gap-2 border-b" style={{ borderColor: "hsl(var(--v2-border))" }}>
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: "hsl(var(--v2-accent))" }}>
            <Shield size={15} />
          </div>
          <span className="font-semibold text-sm">Phantom</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "hsl(var(--v2-bg-card))", color: "hsl(var(--v2-fg-muted))" }}>v2</span>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? "text-white" : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`
              }
              style={({ isActive }: any) => isActive ? { background: "hsl(var(--v2-accent) / 0.15)", color: "hsl(var(--v2-accent))" } : {}}
            >
              <item.icon size={15} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: "hsl(var(--v2-border))" }}>
          <div className="text-xs mb-2 truncate" style={{ color: "hsl(var(--v2-fg-muted))" }}>{email}</div>
          <button onClick={handleLogout} className="v2-btn v2-btn-secondary w-full text-xs" style={{ padding: "0.4rem 0.75rem" }}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header className="h-16 border-b px-8 flex items-center" style={{ borderColor: "hsl(var(--v2-border))" }}>
          <h1 className="font-semibold">{title}</h1>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
};

export default V2Layout;
