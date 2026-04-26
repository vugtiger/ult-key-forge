import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import V2Layout from "../components/V2Layout";
import { useV2Projects, ProjectSelector, NoProjectEmpty } from "../lib/useV2Projects";
import { Users as UsersIcon, Ban } from "lucide-react";

interface KeyUser { key_value: string; bound_hwid: string | null; bound_discord_id: string | null; bound_ip: string | null; created_at: string; note: string | null; }

const V2Users = () => {
  const { projects, selected, select } = useV2Projects();
  const [users, setUsers] = useState<KeyUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!selected) { setUsers([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("v2_keys").select("key_value, bound_hwid, bound_discord_id, bound_ip, created_at, note")
      .eq("project_id", selected).not("bound_hwid", "is", null).order("created_at", { ascending: false });
    setUsers(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [selected]);

  const blacklistHwid = async (hwid: string | null) => {
    if (!hwid || !selected) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (!confirm(`Blacklist HWID ${hwid.slice(0, 12)}…?`)) return;
    await supabase.from("v2_blacklist").insert({ project_id: selected, user_id: user.id, entry_type: "hwid", entry_value: hwid });
    alert("Added to blacklist");
  };

  return (
    <V2Layout
      title="Users"
      subtitle={`${users.length} active user${users.length !== 1 ? "s" : ""}`}
      actions={<ProjectSelector projects={projects} selected={selected} onChange={select} />}
    >
      {!selected ? <NoProjectEmpty icon={UsersIcon} label="users" />
      : loading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="v2-card h-16 animate-pulse" />)}</div>
      : users.length === 0 ? (
        <div className="v2-card p-16 text-center">
          <UsersIcon size={28} className="mx-auto mb-3 text-white/40" />
          <h3 className="font-semibold mb-1">No active users yet</h3>
          <p className="text-sm text-white/45">Users appear here once they redeem a key and bind a HWID.</p>
        </div>
      ) : (
        <div className="v2-card overflow-hidden">
          <table className="v2-table">
            <thead><tr><th>Key</th><th>HWID</th><th>Discord</th><th>IP</th><th>Note</th><th></th></tr></thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={i}>
                  <td className="v2-mono text-xs text-white/85">{u.key_value}</td>
                  <td className="v2-mono text-[11px] text-white/55">{u.bound_hwid?.slice(0, 16)}…</td>
                  <td className="text-white/55 text-xs">{u.bound_discord_id || "—"}</td>
                  <td className="v2-mono text-[11px] text-white/55">{u.bound_ip || "—"}</td>
                  <td className="text-white/55 text-xs">{u.note || "—"}</td>
                  <td className="text-right">
                    <button onClick={() => blacklistHwid(u.bound_hwid)} className="v2-btn v2-btn-ghost text-red-400 text-xs" style={{ padding: "0.3rem 0.55rem" }}><Ban size={12} /> Blacklist</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </V2Layout>
  );
};

export default V2Users;
