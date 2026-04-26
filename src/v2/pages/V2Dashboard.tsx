import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import V2Layout from "../components/V2Layout";
import { Plus, FolderKanban, Trash2, FileCode2, Key as KeyIcon, Activity } from "lucide-react";

interface Project { id: string; name: string; description: string | null; created_at: string; }

const V2Dashboard = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [counts, setCounts] = useState<Record<string, { scripts: number; keys: number; logs: number }>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("v2_projects").select("*").order("created_at", { ascending: false });
    setProjects(data || []);

    if (data) {
      const c: Record<string, any> = {};
      await Promise.all(data.map(async (p) => {
        const [{ count: s }, { count: k }, { count: l }] = await Promise.all([
          supabase.from("v2_scripts").select("*", { count: "exact", head: true }).eq("project_id", p.id),
          supabase.from("v2_keys").select("*", { count: "exact", head: true }).eq("project_id", p.id),
          supabase.from("v2_logs").select("*", { count: "exact", head: true }).eq("project_id", p.id),
        ]);
        c[p.id] = { scripts: s || 0, keys: k || 0, logs: l || 0 };
      }));
      setCounts(c);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !name.trim()) return;
    await supabase.from("v2_projects").insert({ user_id: user.id, name: name.trim(), description: desc.trim() || null });
    setName(""); setDesc(""); setCreating(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this project? All scripts, keys, and logs will be wiped.")) return;
    await supabase.from("v2_projects").delete().eq("id", id);
    load();
  };

  return (
    <V2Layout
      title="Projects"
      subtitle={`${projects.length} project${projects.length !== 1 ? "s" : ""}`}
      actions={
        <button onClick={() => setCreating(!creating)} className="v2-btn v2-btn-primary">
          <Plus size={14} /> New project
        </button>
      }
    >
      {creating && (
        <form onSubmit={create} className="v2-card p-5 mb-6 space-y-3 v2-animate">
          <div>
            <label className="text-xs block mb-1.5 text-white/60 font-medium">Name</label>
            <input autoFocus className="v2-input" placeholder="My awesome script" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs block mb-1.5 text-white/60 font-medium">Description (optional)</label>
            <input className="v2-input" placeholder="What's this for?" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" className="v2-btn v2-btn-primary">Create project</button>
            <button type="button" onClick={() => setCreating(false)} className="v2-btn v2-btn-ghost">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="v2-card h-40 animate-pulse" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="v2-card p-16 text-center">
          <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
            <FolderKanban size={24} className="text-white/40" />
          </div>
          <h3 className="font-semibold mb-1">No projects yet</h3>
          <p className="text-sm text-white/45 mb-6">Create your first project to start protecting scripts.</p>
          <button onClick={() => setCreating(true)} className="v2-btn v2-btn-primary">
            <Plus size={14} /> Create project
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const c = counts[p.id] || { scripts: 0, keys: 0, logs: 0 };
            return (
              <div key={p.id} className="v2-card p-5 group relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <FolderKanban size={16} className="text-white/70" />
                  </div>
                  <button onClick={() => remove(p.id)} className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 transition p-1.5">
                    <Trash2 size={14} />
                  </button>
                </div>
                <h3 className="font-semibold mb-1 truncate">{p.name}</h3>
                <p className="text-sm text-white/45 mb-4 truncate">{p.description || "No description"}</p>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1">
                      <FileCode2 size={10} /> Scripts
                    </div>
                    <div className="font-semibold">{c.scripts}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1">
                      <KeyIcon size={10} /> Keys
                    </div>
                    <div className="font-semibold">{c.keys}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1">
                      <Activity size={10} /> Logs
                    </div>
                    <div className="font-semibold">{c.logs}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </V2Layout>
  );
};

export default V2Dashboard;
