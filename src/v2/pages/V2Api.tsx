import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import V2Layout from "../components/V2Layout";
import { Plus, Trash2, Code2, Copy, Check } from "lucide-react";

const V2Api = () => {
  const [tokens, setTokens] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("v2_api_tokens").select("*").order("created_at", { ascending: false });
    setTokens(data || []);
  };
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token = "NBL_" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabase.from("v2_api_tokens").insert({ user_id: user.id, name: name.trim(), token });
    if (!error) { setRevealed(token); setName(""); load(); }
  };

  const remove = async (id: string) => {
    await supabase.from("v2_api_tokens").delete().eq("id", id);
    load();
  };

  const copy = (t: string) => { navigator.clipboard.writeText(t); setCopied(t); setTimeout(() => setCopied(null), 2000); };

  return (
    <V2Layout title="API Tokens" subtitle="Generate, check, revoke keys from your own backend">
      <div className="v2-card p-5 mb-6">
        <div className="text-xs uppercase tracking-wider text-white/40 mb-3">Endpoints</div>
        <div className="space-y-2 v2-mono text-xs">
          {[
            ["POST", "/nebula-api/keys/generate", "Generate new keys"],
            ["GET ", "/nebula-api/keys/check?key=X&hwid=Y", "Validate a key"],
            ["DEL ", "/nebula-api/keys/revoke?key=X", "Revoke a key"],
            ["POST", "/nebula-api/keys/reset?key=X", "Reset HWID lock"],
          ].map(([m, p, d]) => (
            <div key={p} className="flex gap-3 items-center p-2 rounded bg-white/[0.02]">
              <span className="v2-badge">{m}</span>
              <span className="text-white/80">{p}</span>
              <span className="text-white/40 ml-auto">{d}</span>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={create} className="v2-card p-5 mb-6 flex gap-3">
        <input className="v2-input" placeholder="Token name (e.g. Production server)" value={name} onChange={e => setName(e.target.value)} />
        <button type="submit" className="v2-btn v2-btn-primary"><Plus size={14} /> Create token</button>
      </form>

      {revealed && (
        <div className="v2-card p-5 mb-6 border-white/20 bg-white/[0.04]">
          <div className="text-xs text-white/60 mb-2">⚠️ Copy your token now — you won't see it again:</div>
          <div className="flex gap-2 items-center">
            <code className="v2-mono text-sm flex-1 p-2.5 bg-black/40 rounded border border-white/10 break-all">{revealed}</code>
            <button onClick={() => copy(revealed)} className="v2-btn v2-btn-secondary">
              {copied === revealed ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <button onClick={() => setRevealed(null)} className="text-xs text-white/50 mt-3 hover:text-white">Done</button>
        </div>
      )}

      {tokens.length === 0 ? (
        <div className="v2-card p-12 text-center text-white/45">
          <Code2 size={28} className="mx-auto mb-3 opacity-40" />
          No API tokens yet.
        </div>
      ) : (
        <div className="v2-card overflow-hidden">
          <table className="v2-table">
            <thead><tr><th>Name</th><th>Token</th><th>Last used</th><th></th></tr></thead>
            <tbody>
              {tokens.map(t => (
                <tr key={t.id}>
                  <td className="font-medium">{t.name}</td>
                  <td className="v2-mono text-xs text-white/50">{t.token.slice(0, 12)}...</td>
                  <td className="text-xs text-white/50">{t.last_used_at ? new Date(t.last_used_at).toLocaleString() : "Never"}</td>
                  <td><button onClick={() => remove(t.id)} className="text-white/40 hover:text-red-400"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </V2Layout>
  );
};

export default V2Api;
