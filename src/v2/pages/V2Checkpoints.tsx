import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import V2Layout from "../components/V2Layout";
import { Plus, Trash2, GitBranch } from "lucide-react";

interface Project { id: string; name: string; }
interface Checkpoint { id: string; project_id: string; step_number: number; label: string; url: string; reward_days: number; }

const V2Checkpoints = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [pid, setPid] = useState<string>("");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [days, setDays] = useState(1);

  const load = async () => {
    const { data: p } = await supabase.from("v2_projects").select("id, name").order("created_at");
    setProjects(p || []);
    if (p?.length && !pid) setPid(p[0].id);
    const { data: c } = await supabase.from("v2_checkpoints").select("*").order("step_number");
    setCheckpoints(c || []);
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pid || !label || !url) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const next = checkpoints.filter(c => c.project_id === pid).length + 1;
    await supabase.from("v2_checkpoints").insert({
      project_id: pid, user_id: user.id, step_number: next, label, url, reward_days: days,
    });
    setLabel(""); setUrl(""); load();
  };

  const remove = async (id: string) => {
    await supabase.from("v2_checkpoints").delete().eq("id", id);
    load();
  };

  return (
    <V2Layout title="Checkpoints" subtitle="Linkvertise-style key claim flows">
      <form onSubmit={add} className="v2-card p-5 mb-6 grid md:grid-cols-5 gap-3">
        <select className="v2-select" value={pid} onChange={e => setPid(e.target.value)}>
          <option value="">Project...</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input className="v2-input md:col-span-1" placeholder="Label (e.g. Like video)" value={label} onChange={e => setLabel(e.target.value)} />
        <input className="v2-input md:col-span-2" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} />
        <input className="v2-input" type="number" min={1} placeholder="Reward days" value={days} onChange={e => setDays(+e.target.value)} />
        <button type="submit" className="v2-btn v2-btn-primary md:col-span-5"><Plus size={14} /> Add checkpoint</button>
      </form>

      {projects.length === 0 ? (
        <div className="v2-card p-12 text-center text-white/45">Create a project first.</div>
      ) : (
        <div className="space-y-2">
          {projects.map(p => {
            const own = checkpoints.filter(c => c.project_id === p.id);
            return (
              <div key={p.id} className="v2-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <GitBranch size={14} className="text-white/40" />
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-xs text-white/40">· {own.length} step{own.length !== 1 && "s"}</span>
                </div>
                {own.length === 0 ? <div className="text-sm text-white/40">No checkpoints.</div> : (
                  <div className="space-y-1.5">
                    {own.map(c => (
                      <div key={c.id} className="flex items-center gap-3 p-2.5 rounded bg-white/[0.02] border border-white/5 text-sm">
                        <span className="v2-badge">#{c.step_number}</span>
                        <span className="font-medium">{c.label}</span>
                        <span className="text-white/40 truncate flex-1 v2-mono text-xs">{c.url}</span>
                        <span className="v2-badge">+{c.reward_days}d</span>
                        <button onClick={() => remove(c.id)} className="text-white/40 hover:text-red-400"><Trash2 size={13} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </V2Layout>
  );
};

export default V2Checkpoints;
