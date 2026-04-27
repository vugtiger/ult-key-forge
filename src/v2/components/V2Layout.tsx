import { ReactNode, useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FolderKanban, FileCode2, Key, Users, Ban, Activity, Webhook, Settings, LogOut, Menu, X, BarChart3, GitBranch, Code2, UserCog } from "lucide-react";
import { v2SignOut } from "../lib/v2Auth";
import NebulaLogo from "./NebulaLogo";
import "../styles/v2.css";

const navItems = [
  { to: "/v2/dashboard", label: "Projects", icon: FolderKanban },
  { to: "/v2/scripts", label: "Scripts", icon: FileCode2 },
  { to: "/v2/keys", label: "Keys", icon: Key },
  { to: "/v2/users", label: "Users", icon: Users },
  { to: "/v2/blacklist", label: "Blacklist", icon: Ban },
  { to: "/v2/checkpoints", label: "Checkpoints", icon: GitBranch },
  { to: "/v2/resellers", label: "Resellers", icon: UserCog },
  { to: "/v2/api", label: "API", icon: Code2 },
  { to: "/v2/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/v2/logs", label: "Logs", icon: Activity },
  { to: "/v2/webhooks", label: "Webhooks", icon: Webhook },
  { to: "/v2/settings", label: "Settings", icon: Settings },
];

const V2Layout = ({ children, title, subtitle, actions }: { children: ReactNode; title?: string; subtitle?: string; actions?: ReactNode }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [open, setOpen] = useState(false);

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
    <div className="v2-root v2-grain flex min-h-screen">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 h-screen z-40 w-60 flex flex-col border-r border-white/[0.06] bg-black/80 backdrop-blur-xl transition-transform ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="px-5 h-16 flex items-center gap-2.5 border-b border-white/[0.06]">
          <NebulaLogo size={22} className="text-white" />
          <span className="font-semibold text-sm tracking-tight">Nebula</span>
          <button onClick={() => setOpen(false)} className="lg:hidden ml-auto text-white/50 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition ${
                  isActive
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/55 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <item.icon size={15} strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.06]">
          <div className="px-2 py-1.5 mb-2 text-[11px] text-white/40 truncate">{email}</div>
          <button onClick={handleLogout} className="v2-btn v2-btn-ghost w-full text-xs justify-start" style={{ padding: "0.45rem 0.75rem" }}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>

      {open && <div className="lg:hidden fixed inset-0 bg-black/60 z-30" onClick={() => setOpen(false)} />}

      {/* Main */}
      <main className="flex-1 min-w-0 relative">
        <header className="h-16 border-b border-white/[0.06] px-6 lg:px-10 flex items-center sticky top-0 z-20 bg-black/60 backdrop-blur-xl">
          <button onClick={() => setOpen(true)} className="lg:hidden mr-3 text-white/70 hover:text-white">
            <Menu size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-base tracking-tight truncate">{title}</h1>
            {subtitle && <p className="text-xs text-white/45 mt-0.5 truncate">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </header>
        <div className="p-6 lg:p-10 v2-animate">{children}</div>
      </main>
    </div>
  );
};

export default V2Layout;
