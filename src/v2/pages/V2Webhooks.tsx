import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import V2Layout from "../components/V2Layout";
import { useV2Projects, ProjectSelector, NoProjectEmpty } from "../lib/useV2Projects";
import { Plus, Webhook, Trash2 } from "lucide-react";

interface Hook { id: string; url: string; events: string[]; enabled: boolean; created_at: string; }
const ALL_EVENTS = ["redeem", "exec", "ban", "blacklist", "expired", "fail"];

const V2Webhooks = () => {
  const { projects, selected, select } = useV2Projects();
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ url: string; events: string[] }>({ url: "", events: ["redeem", "exec", "ban"] });

  const load = async () => {
    if (!selected) { setHooks([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("v2_webhooks").select("*").eq("project_id", selected).order("created_at", { ascending: false });
    setHooks((data || []).map(h => ({ ...h, events: Array.isArray(h.events) ? h.events as string[] : [] })));
    setLoading(false);
  };
  useEffect(() => { load(); }, [selected]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !selected) return;
    await supabase.from("v2_webhooks").insert({ project_id: selected, user_id: user.id, url: form.url, events: form.events as any });
    setForm({ url: "", events: ["redeem", "exec", "ban"] }); setCreating(false); load();
  };

  const toggle = async (h: Hook) => { await supabase.from("v2_webhooks").update({ enabled: !h.enabled }).eq("id", h.id); load(); };
  const remove = async (id: string) => { if (!confirm("Delete webhook?")) return; await supabase.from("v2_webhooks").delete().eq("id", id); load(); };

  const toggleEvent = (ev: string) => {
    setForm(f => ({ ...f, events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev] }));
  };

  return (
    <V2Layout
      title="Webhooks"
      subtitle={`${hooks.length} webhook${hooks.length !== 1 ? "s" : ""}`}
      actions={
        <>
          <ProjectSelector projects={projects} selected={selected} onChange={select} />
          {selected && <button onClick={() => setCreating(!creating)} className="v2-btn v2-btn-primary"><Plus size={14} /> Add webhook</button>}
        </>
      }
    >
      {!selected ? <NoProjectEmpty icon={Webhook} label="webhooks" /> : (
        <>
          {creating && (
            <form onSubmit={add} className="v2-card p-5 mb-6 space-y-3 v2-animate">
              <div>
                <label className="text-xs block mb-1.5 text-white/60 font-medium">Discord webhook URL</label>
                <input type="url" required className="v2-input" placeholder="https://discord.com/api/webhooks/…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </div>
              <div>
                <label className="text-xs block mb-1.5 text-white/60 font-medium">Events</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_EVENTS.map(ev => (
                    <button key={ev} type="button" onClick={() => toggleEvent(ev)}
                      className={`v2-badge cursor-pointer ${form.events.includes(ev) ? "v2-badge-success" : ""}`}>
                      {ev}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2"><button type="submit" className="v2-btn v2-btn-primary">Add webhook</button>
              <button type="button" onClick={() => setCreating(false)} className="v2-btn v2-btn-ghost">Cancel</button></div>
            </form>
          )}

          {loading ? <div className="space-y-2">{[1,2].map(i => <div key={i} className="v2-card h-20 animate-pulse" />)}</div>
          : hooks.length === 0 ? (
            <div className="v2-card p-16 text-center">
              <Webhook size={28} className="mx-auto mb-3 text-white/40" />
              <h3 className="font-semibold mb-1">No webhooks</h3>
              <p className="text-sm text-white/45">Pipe events into Discord, Slack, or your own service.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {hooks.map(h => (
                <div key={h.id} className="v2-card p-4 flex items-center gap-4">
                  <div className={`v2-dot ${h.enabled ? "v2-dot-active" : "v2-dot-idle"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="v2-mono text-xs truncate text-white/85">{h.url}</div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {h.events.map(ev => <span key={ev} className="v2-badge text-[10px]">{ev}</span>)}
                    </div>
                  </div>
                  <button onClick={() => toggle(h)} className="v2-btn v2-btn-ghost text-xs">{h.enabled ? "Disable" : "Enable"}</button>
                  <button onClick={() => remove(h.id)} className="v2-btn v2-btn-ghost text-red-400" style={{ padding: "0.4rem 0.55rem" }}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </V2Layout>
  );
};

export default V2Webhooks;
