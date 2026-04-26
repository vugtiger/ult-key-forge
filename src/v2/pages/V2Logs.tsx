import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import V2Layout from "../components/V2Layout";
import { useV2Projects, ProjectSelector, NoProjectEmpty } from "../lib/useV2Projects";
import { Activity, RefreshCw } from "lucide-react";

interface Log { id: string; event_type: string; ip_address: string | null; hwid: string | null; details: any; created_at: string; }

const eventColor = (t: string) => {
  if (t.includes("success") || t === "redeem" || t === "exec") return "v2-badge-success";
  if (t.includes("fail") || t.includes("ban") || t.includes("block")) return "v2-badge-danger";
  if (t.includes("warn") || t.includes("expired")) return "v2-badge-warning";
  return "";
};

const V2Logs = () => {
  const { projects, selected, select } = useV2Projects();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = async () => {
    if (!selected) { setLogs([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("v2_logs").select("*").eq("project_id", selected).order("created_at", { ascending: false }).limit(200);
    setLogs(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [selected]);

  const filtered = filter ? logs.filter(l => l.event_type.includes(filter) || l.ip_address?.includes(filter) || l.hwid?.includes(filter)) : logs;

  return (
    <V2Layout
      title="Logs"
      subtitle={`Last ${logs.length} events`}
      actions={
        <>
          <ProjectSelector projects={projects} selected={selected} onChange={select} />
          <button onClick={load} className="v2-btn v2-btn-secondary"><RefreshCw size={14} /> Refresh</button>
        </>
      }
    >
      {!selected ? <NoProjectEmpty icon={Activity} label="logs" /> : (
        <>
          <input className="v2-input mb-4" placeholder="Filter by event, IP, or HWID…" value={filter} onChange={(e) => setFilter(e.target.value)} />

          {loading ? <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="v2-card h-12 animate-pulse" />)}</div>
          : filtered.length === 0 ? (
            <div className="v2-card p-16 text-center">
              <Activity size={28} className="mx-auto mb-3 text-white/40" />
              <h3 className="font-semibold mb-1">No logs yet</h3>
              <p className="text-sm text-white/45">Events will appear here as users redeem keys and execute scripts.</p>
            </div>
          ) : (
            <div className="v2-card overflow-hidden">
              <table className="v2-table">
                <thead><tr><th>Event</th><th>IP</th><th>HWID</th><th>Details</th><th>Time</th></tr></thead>
                <tbody>
                  {filtered.map(l => (
                    <tr key={l.id}>
                      <td><span className={`v2-badge ${eventColor(l.event_type)}`}>{l.event_type}</span></td>
                      <td className="v2-mono text-[11px] text-white/55">{l.ip_address || "—"}</td>
                      <td className="v2-mono text-[11px] text-white/55">{l.hwid?.slice(0, 12) || "—"}{l.hwid && "…"}</td>
                      <td className="text-white/55 text-xs v2-mono truncate max-w-xs">{Object.keys(l.details || {}).length ? JSON.stringify(l.details) : "—"}</td>
                      <td className="text-white/45 text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
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

export default V2Logs;
