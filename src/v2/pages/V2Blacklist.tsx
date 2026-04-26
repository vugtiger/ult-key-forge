import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import V2Layout from "../components/V2Layout";
import { useV2Projects, ProjectSelector, NoProjectEmpty } from "../lib/useV2Projects";
import { Plus, Ban, Trash2 } from "lucide-react";

interface BL { id: string; entry_type: string; entry_value: string; reason: string | null; created_at: string; }

const V2Blacklist = () => {
  const { projects, selected, select } = useV2Projects();
  const [items, setItems] = useState<BL[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ entry_type: "hwid", entry_value: "", reason: "" });

  const load = async () => {
    if (!selected) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("v2_blacklist").select("*").eq("project_id", selected).order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [selected]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !selected || !form.entry_value.trim()) return;
    await supabase.from("v2_blacklist").insert({
      project_id: selected, user_id: user.id,
      entry_type: form.entry_type, entry_value: form.entry_value.trim(),
      reason: form.reason.trim() || null,
    });
    setForm({ entry_type: "hwid", entry_value: "", reason: "" }); setCreating(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove from blacklist?")) return;
    await supabase.from("v2_blacklist").delete().eq("id", id); load();
  };

  return (
    <V2Layout
      title="Blacklist"
      subtitle={`${items.length} blocked entr${items.length !== 1 ? "ies" : "y"}`}
      actions={
        <>
          <ProjectSelector projects={projects} selected={selected} onChange={select} />
          {selected && <button onClick={() => setCreating(!creating)} className="v2-btn v2-btn-primary"><Plus size={14} /> Add</button>}
        </>
      }
    >
      {!selected ? <NoProjectEmpty icon={Ban} label="blacklist" /> : (
        <>
          {creating && (
            <form onSubmit={add} className="v2-card p-5 mb-6 space-y-3 v2-animate">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs block mb-1.5 text-white/60 font-medium">Type</label>
                  <select className="v2-select" value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value })}>
                    <option value="hwid">HWID</option><option value="ip">IP</option><option value="discord_id">Discord ID</option><option value="user_id">Roblox User ID</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs block mb-1.5 text-white/60 font-medium">Value</label>
                  <input className="v2-input v2-mono text-xs" placeholder="Enter value to block" value={form.entry_value} onChange={(e) => setForm({ ...form, entry_value: e.target.value })} required />
                </div>
              </div>
              <input className="v2-input" placeholder="Reason (optional)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              <div className="flex gap-2"><button type="submit" className="v2-btn v2-btn-danger">Add to blacklist</button>
              <button type="button" onClick={() => setCreating(false)} className="v2-btn v2-btn-ghost">Cancel</button></div>
            </form>
          )}

          {loading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="v2-card h-16 animate-pulse" />)}</div>
          : items.length === 0 ? (
            <div className="v2-card p-16 text-center">
              <Ban size={28} className="mx-auto mb-3 text-white/40" />
              <h3 className="font-semibold mb-1">Blacklist is empty</h3>
              <p className="text-sm text-white/45">Block bad actors by HWID, IP, Discord ID, or Roblox user ID.</p>
            </div>
          ) : (
            <div className="v2-card overflow-hidden">
              <table className="v2-table">
                <thead><tr><th>Type</th><th>Value</th><th>Reason</th><th>Added</th><th></th></tr></thead>
                <tbody>
                  {items.map(b => (
                    <tr key={b.id}>
                      <td><span className="v2-badge">{b.entry_type}</span></td>
                      <td className="v2-mono text-xs text-white/85">{b.entry_value}</td>
                      <td className="text-white/55 text-xs">{b.reason || "—"}</td>
                      <td className="text-white/55 text-xs">{new Date(b.created_at).toLocaleDateString()}</td>
                      <td className="text-right">
                        <button onClick={() => remove(b.id)} className="v2-btn v2-btn-ghost text-red-400" style={{ padding: "0.3rem 0.55rem" }}><Trash2 size={13} /></button>
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

export default V2Blacklist;
