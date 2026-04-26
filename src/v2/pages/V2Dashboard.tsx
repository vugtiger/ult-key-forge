import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import V2Layout from "../components/V2Layout";
import { Plus, FolderKanban } from "lucide-react";

interface Project { id: string; name: string; description: string | null; created_at: string; }

const V2Dashboard = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("v2_projects").select("*").order("created_at", { ascending: false });
    setProjects(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !name.trim()) return;
    await supabase.from("v2_projects").insert({ user_id: user.id, name: name.trim() });
    setName(""); setCreating(false); load();
  };

  return (
    <V2Layout title="Projects">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm" style={{ color: "hsl(var(--v2-fg-muted))" }}>
          {projects.length} project{projects.length !== 1 ? "s" : ""}
        </p>
        <button onClick={() => setCreating(!creating)} className="v2-btn v2-btn-primary">
          <Plus size={14} /> New project
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="v2-card p-4 mb-6 flex gap-2">
          <input autoFocus className="v2-input" placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="v2-btn v2-btn-primary">Create</button>
        </form>
      )}

      {loading ? (
        <div className="text-sm" style={{ color: "hsl(var(--v2-fg-muted))" }}>Loading...</div>
      ) : projects.length === 0 ? (
        <div className="v2-card p-12 text-center">
          <FolderKanban size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm" style={{ color: "hsl(var(--v2-fg-muted))" }}>No projects yet. Create your first one.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((p) => (
            <div key={p.id} className="v2-card p-5 hover:border-white/20 transition cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <FolderKanban size={16} style={{ color: "hsl(var(--v2-accent))" }} />
                <h3 className="font-semibold text-sm">{p.name}</h3>
              </div>
              {p.description && <p className="text-xs mb-3" style={{ color: "hsl(var(--v2-fg-muted))" }}>{p.description}</p>}
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "hsl(var(--v2-fg-muted))" }}>
                {new Date(p.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </V2Layout>
  );
};

export default V2Dashboard;
