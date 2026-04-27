import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import V2Layout from "../components/V2Layout";
import { Plus, Trash2, UserCog } from "lucide-react";

const V2Resellers = () => {
  const [resellers, setResellers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [pid, setPid] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const { data: r } = await supabase.from("v2_resellers").select("*, v2_projects(name)").order("created_at", { ascending: false });
    setResellers(r || []);
    const { data: p } = await supabase.from("v2_projects").select("id, name");
    setProjects(p || []);
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!email) return;
    const { data: target } = await supabase.from("v2_profiles").select("id, display_name").eq("display_name", email.split("@")[0]).maybeSingle();
    if (!target) { setErr("No Nebula user found with that username/email."); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("v2_resellers").insert({
      owner_id: user.id, reseller_user_id: target.id, project_id: pid || null,
    });
    if (error) { setErr(error.message); return; }
    setEmail(""); setPid(""); load();
  };

  const remove = async (id: string) => {
    await supabase.from("v2_resellers").delete().eq("id", id);
    load();
  };

  return (
    <V2Layout title="Resellers" subtitle="Add staff who can generate keys for you">
      <form onSubmit={add} className="v2-card p-5 mb-6 grid md:grid-cols-4 gap-3">
        <input className="v2-input md:col-span-2" placeholder="Reseller username" value={email} onChange={e => setEmail(e.target.value)} />
        <select className="v2-select" value={pid} onChange={e => setPid(e.target.value)}>
          <option value="">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button type="submit" className="v2-btn v2-btn-primary"><Plus size={14} /> Add reseller</button>
        {err && <div className="md:col-span-4 text-xs p-2.5 rounded bg-red-500/10 border border-red-500/20 text-red-400">{err}</div>}
      </form>

      {resellers.length === 0 ? (
        <div className="v2-card p-12 text-center text-white/45">
          <UserCog size={28} className="mx-auto mb-3 opacity-40" />
          No resellers yet.
        </div>
      ) : (
        <div className="v2-card overflow-hidden">
          <table className="v2-table">
            <thead><tr><th>Reseller</th><th>Project</th><th>Permissions</th><th></th></tr></thead>
            <tbody>
              {resellers.map(r => (
                <tr key={r.id}>
                  <td className="v2-mono">{r.reseller_user_id.slice(0, 8)}...</td>
                  <td>{r.v2_projects?.name || <span className="text-white/40">All</span>}</td>
                  <td className="text-xs text-white/50">{Object.entries(r.permissions || {}).filter(([, v]) => v).map(([k]) => k).join(", ")}</td>
                  <td><button onClick={() => remove(r.id)} className="text-white/40 hover:text-red-400"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </V2Layout>
  );
};

export default V2Resellers;
