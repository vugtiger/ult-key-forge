import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import V2Layout from "../components/V2Layout";
import { Activity, Key as KeyIcon, Users, TrendingUp } from "lucide-react";

const V2Analytics = () => {
  const [stats, setStats] = useState({ totalKeys: 0, activeKeys: 0, execs7d: 0, uniqueUsers: 0 });
  const [byDay, setByDay] = useState<{ day: string; count: number }[]>([]);

  useEffect(() => {
    (async () => {
      const [{ count: tk }, { count: ak }, { data: stats7 }] = await Promise.all([
        supabase.from("v2_keys").select("*", { count: "exact", head: true }),
        supabase.from("v2_keys").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("v2_exec_stats").select("day, exec_count, unique_users").gte("day", new Date(Date.now() - 7 * 86400e3).toISOString().slice(0, 10)).order("day"),
      ]);
      const total = (stats7 || []).reduce((s, r: any) => s + (r.exec_count || 0), 0);
      const uu = (stats7 || []).reduce((s, r: any) => s + (r.unique_users || 0), 0);
      setStats({ totalKeys: tk || 0, activeKeys: ak || 0, execs7d: total, uniqueUsers: uu });
      setByDay((stats7 || []).map((r: any) => ({ day: r.day.slice(5), count: r.exec_count })));
    })();
  }, []);

  const max = Math.max(1, ...byDay.map(d => d.count));

  const cards = [
    { icon: KeyIcon, label: "Total keys", value: stats.totalKeys },
    { icon: Activity, label: "Active keys", value: stats.activeKeys },
    { icon: TrendingUp, label: "Execs (7d)", value: stats.execs7d },
    { icon: Users, label: "Unique users (7d)", value: stats.uniqueUsers },
  ];

  return (
    <V2Layout title="Analytics" subtitle="Last 7 days">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {cards.map(c => (
          <div key={c.label} className="v2-card p-4">
            <div className="flex items-center gap-2 text-white/45 text-xs mb-2"><c.icon size={13} /> {c.label}</div>
            <div className="text-2xl font-bold tracking-tight">{c.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="v2-card p-6">
        <div className="text-sm font-semibold mb-4">Executions per day</div>
        {byDay.length === 0 ? (
          <div className="text-center py-12 text-white/40 text-sm">No execution data yet.</div>
        ) : (
          <div className="flex items-end gap-2 h-48">
            {byDay.map(d => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-[10px] text-white/40">{d.count}</div>
                <div className="w-full rounded-t bg-white/80 hover:bg-white transition" style={{ height: `${(d.count / max) * 100}%`, minHeight: 2 }} />
                <div className="text-[10px] text-white/40">{d.day}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </V2Layout>
  );
};

export default V2Analytics;
