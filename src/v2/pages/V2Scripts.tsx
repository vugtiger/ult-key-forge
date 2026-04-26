import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import V2Layout from "../components/V2Layout";
import { useV2Projects, ProjectSelector, NoProjectEmpty } from "../lib/useV2Projects";
import { Plus, FileCode2, Trash2, Edit3, Save, X } from "lucide-react";

interface Script { id: string; name: string; content: string; obfuscated: boolean; created_at: string; }

const V2Scripts = () => {
  const { projects, selected, select } = useV2Projects();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Script | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", content: "" });

  const load = async () => {
    if (!selected) { setScripts([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("v2_scripts").select("*").eq("project_id", selected).order("created_at", { ascending: false });
    setScripts(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [selected]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !selected) return;
    if (editing) {
      await supabase.from("v2_scripts").update({ name: form.name, content: form.content }).eq("id", editing.id);
    } else {
      await supabase.from("v2_scripts").insert({ project_id: selected, user_id: user.id, name: form.name, content: form.content });
    }
    setEditing(null); setCreating(false); setForm({ name: "", content: "" }); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this script?")) return;
    await supabase.from("v2_scripts").delete().eq("id", id);
    load();
  };

  const startEdit = (s: Script) => { setEditing(s); setCreating(true); setForm({ name: s.name, content: s.content }); };
  const cancel = () => { setEditing(null); setCreating(false); setForm({ name: "", content: "" }); };

  return (
    <V2Layout
      title="Scripts"
      subtitle={`${scripts.length} script${scripts.length !== 1 ? "s" : ""} in this project`}
      actions={
        <>
          <ProjectSelector projects={projects} selected={selected} onChange={select} />
          {selected && (
            <button onClick={() => { setCreating(true); setEditing(null); setForm({ name: "", content: "" }); }} className="v2-btn v2-btn-primary">
              <Plus size={14} /> New script
            </button>
          )}
        </>
      }
    >
      {!selected ? (
        <NoProjectEmpty icon={FileCode2} label="scripts" />
      ) : (
        <>
          {creating && (
            <form onSubmit={save} className="v2-card p-5 mb-6 space-y-3 v2-animate">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{editing ? "Edit script" : "New script"}</h3>
                <button type="button" onClick={cancel} className="text-white/40 hover:text-white"><X size={16} /></button>
              </div>
              <input className="v2-input" placeholder="Script name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <textarea className="v2-textarea v2-mono" placeholder="-- Your Lua code here&#10;print('hello')" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={12} />
              <button type="submit" className="v2-btn v2-btn-primary"><Save size={14} /> {editing ? "Save changes" : "Create script"}</button>
            </form>
          )}

          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="v2-card h-16 animate-pulse" />)}</div>
          ) : scripts.length === 0 ? (
            <div className="v2-card p-16 text-center">
              <FileCode2 size={28} className="mx-auto mb-3 text-white/40" />
              <h3 className="font-semibold mb-1">No scripts yet</h3>
              <p className="text-sm text-white/45">Add your first protected script.</p>
            </div>
          ) : (
            <div className="v2-card overflow-hidden">
              <table className="v2-table">
                <thead><tr><th>Name</th><th>Size</th><th>Status</th><th>Created</th><th></th></tr></thead>
                <tbody>
                  {scripts.map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.name}</td>
                      <td className="text-white/55">{s.content.length} chars</td>
                      <td><span className={`v2-badge ${s.obfuscated ? "v2-badge-success" : ""}`}>{s.obfuscated ? "Protected" : "Plain"}</span></td>
                      <td className="text-white/55 text-xs">{new Date(s.created_at).toLocaleDateString()}</td>
                      <td className="text-right">
                        <button onClick={() => startEdit(s)} className="v2-btn v2-btn-ghost" style={{ padding: "0.3rem 0.55rem" }}><Edit3 size={13} /></button>
                        <button onClick={() => remove(s.id)} className="v2-btn v2-btn-ghost text-red-400 hover:text-red-300" style={{ padding: "0.3rem 0.55rem" }}><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </V2Layout>
  );
};

export default V2Scripts;
