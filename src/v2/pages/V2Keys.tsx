import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import V2Layout from "../components/V2Layout";
import { useV2Projects, ProjectSelector, NoProjectEmpty } from "../lib/useV2Projects";
import { Plus, Key as KeyIcon, Trash2, Copy, Check } from "lucide-react";

interface KeyRow { id: string; key_value: string; note: string | null; bound_hwid: string | null; bound_discord_id: string | null; expires_at: string | null; is_active: boolean; created_at: string; }

const generateKey = () => {
  const r = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n))).map(b => b.toString(16).padStart(2, "0")).join("");
  return `PHX-${r(4).toUpperCase()}-${r(4).toUpperCase()}-${r(6).toUpperCase()}`;
};

const V2Keys = () => {
  const { projects, selected, select } = useV2Projects();
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ amount: 1, note: "", duration: "30" });
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    if (!selected) { setKeys([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("v2_keys").select("*").eq("project_id", selected).order("created_at", { ascending: false });
    setKeys(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [selected]);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !selected) return;
    const days = parseInt(form.duration);
    const expires_at = days > 0 ? new Date(Date.now() + days * 86400 * 1000).toISOString() : null;
    const rows = Array.from({ length: form.amount }, () => ({
      project_id: selected, user_id: user.id, key_value: generateKey(),
      note: form.note || null, expires_at, is_active: true,
    }));
    await supabase.from("v2_keys").insert(rows);
    setForm({ amount: 1, note: "", duration: "30" }); setCreating(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Revoke this key?")) return;
    await supabase.from("v2_keys").delete().eq("id", id); load();
  };
  const toggle = async (k: KeyRow) => { await supabase.from("v2_keys").update({ is_active: !k.is_active }).eq("id", k.id); load(); };
  const copy = (v: string) => { navigator.clipboard.writeText(v); setCopied(v); setTimeout(() => setCopied(null), 1500); };

  return (
    <V2Layout
      title="Keys"
      subtitle={`${keys.length} key${keys.length !== 1 ? "s" : ""} in this project`}
      actions={
        <>
          <ProjectSelector projects={projects} selected={selected} onChange={select} />
          {selected && <button onClick={() => setCreating(!creating)} className="v2-btn v2-btn-primary"><Plus size={14} /> Generate</button>}
        </>
      }
    >
      {!selected ? <NoProjectEmpty icon={KeyIcon} label="keys" /> : (
        <>
          {creating && (
            <form onSubmit={generate} className="v2-card p-5 mb-6 space-y-3 v2-animate">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs block mb-1.5 text-white/60 font-medium">Amount</label>
                  <input type="number" min={1} max={100} className="v2-input" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                  <label className="text-xs block mb-1.5 text-white/60 font-medium">Duration</label>
                  <select className="v2-select" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}>
                    <option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="0">Permanent</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs block mb-1.5 text-white/60 font-medium">Note (optional)</label>
                  <input className="v2-input" placeholder="Buyer name" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="v2-btn v2-btn-primary">Generate {form.amount}</button>
                <button type="button" onClick={() => setCreating(false)} className="v2-btn v2-btn-ghost">Cancel</button>
              </div>
            </form>
          )}

          {loading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="v2-card h-16 animate-pulse" />)}</div>
          : keys.length === 0 ? (
            <div className="v2-card p-16 text-center">
              <KeyIcon size={28} className="mx-auto mb-3 text-white/40" />
              <h3 className="font-semibold mb-1">No keys yet</h3>
              <p className="text-sm text-white/45">Generate keys to give to your users.</p>
            </div>
          ) : (
            <div className="v2-card overflow-hidden">
              <table className="v2-table">
                <thead><tr><th>Key</th><th>Note</th><th>HWID</th><th>Expires</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {keys.map(k => {
                    const expired = k.expires_at && new Date(k.expires_at) < new Date();
                    return (
                      <tr key={k.id}>
                        <td>
                          <button onClick={() => copy(k.key_value)} className="v2-mono text-xs hover:text-white text-white/85 inline-flex items-center gap-1.5">
                            {k.key_value} {copied === k.key_value ? <Check size={11} className="text-green-400" /> : <Copy size={11} className="opacity-50" />}
                          </button>
                        </td>
                        <td className="text-white/55 text-xs">{k.note || "—"}</td>
                        <td className="text-white/55 v2-mono text-[11px]">{k.bound_hwid ? k.bound_hwid.slice(0, 12) + "…" : <span className="text-white/30">unbound</span>}</td>
                        <td className="text-white/55 text-xs">{k.expires_at ? new Date(k.expires_at).toLocaleDateString() : "Never"}</td>
                        <td>
                          {expired ? <span className="v2-badge v2-badge-warning">Expired</span>
                          : k.is_active ? <span className="v2-badge v2-badge-success">Active</span>
                          : <span className="v2-badge v2-badge-danger">Disabled</span>}
                        </td>
                        <td className="text-right">
                          <button onClick={() => toggle(k)} className="v2-btn v2-btn-ghost text-xs" style={{ padding: "0.3rem 0.5rem" }}>{k.is_active ? "Disable" : "Enable"}</button>
                          <button onClick={() => remove(k.id)} className="v2-btn v2-btn-ghost text-red-400" style={{ padding: "0.3rem 0.5rem" }}><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </V2Layout>
  );
};

export default V2Keys;
