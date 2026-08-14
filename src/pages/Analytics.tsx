import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import TabHelpSection from "@/components/onboarding/TabHelpSection";
import { analyticsHelp } from "@/components/onboarding/helpContent";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Activity, Users, FileCode, TrendingUp, BarChart3, ShieldCheck, Cpu, Globe,
  AlertTriangle, RefreshCw, Clock,
} from "lucide-react";
import Tilt3DCard from "@/components/Tilt3DCard";
import { Button } from "@/components/ui/button";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--muted-foreground))",
];

const RANGES = [7, 14, 30] as const;
type Range = (typeof RANGES)[number];

interface DayPoint { date: string; executions: number; visits: number }
interface ScriptRow {
  id: string;
  label: string;
  executions: number;
  uniqueUsers: number;
  devices: number;
  visits: number;
  protectedScript: boolean;
  lastExecuted: string | null;
}

const dayKey = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtAgo = (iso: string | null) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const Analytics = () => {
  const [range, setRange] = useState<Range>(7);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [series, setSeries] = useState<DayPoint[]>([]);
  const [scripts, setScripts] = useState<ScriptRow[]>([]);
  const [activityData, setActivityData] = useState<{ type: string; count: number }[]>([]);
  const [totals, setTotals] = useState({
    pastes: 0,
    protectedPastes: 0,
    executions: 0,
    executionsInRange: 0,
    uniqueUsers: 0,
    devices: 0,
    browserVisits: 0,
    executorVisits: 0,
    uniqueIps: 0,
    blockedDevices: 0,
    threats: 0,
    lastActivity: null as string | null,
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const since = new Date();
        since.setDate(since.getDate() - (range - 1));
        since.setHours(0, 0, 0, 0);

        const { data: pastes } = await supabase
          .from("pastes")
          .select("id, title, slug, protection_enabled")
          .eq("user_id", user.id);

        const pasteIds = (pastes || []).map((p) => p.id);

        let executions: { paste_id: string; roblox_user_id: string; executed_at: string }[] = [];
        let logs: { paste_id: string; ip_address: string; access_type: string; created_at: string; last_seen_at: string }[] = [];
        let hwids: { paste_id: string; hwid: string }[] = [];

        if (pasteIds.length) {
          const [ex, lg, hw] = await Promise.all([
            supabase.from("paste_executions").select("paste_id, roblox_user_id, executed_at").in("paste_id", pasteIds),
            supabase.from("paste_access_logs").select("paste_id, ip_address, access_type, created_at, last_seen_at").in("paste_id", pasteIds),
            supabase.from("paste_hwid_locks").select("paste_id, hwid").in("paste_id", pasteIds),
          ]);
          executions = (ex.data as typeof executions) || [];
          logs = (lg.data as typeof logs) || [];
          hwids = (hw.data as typeof hwids) || [];
        }

        const { data: activities } = await supabase
          .from("user_activity").select("activity_type").eq("user_id", user.id);

        // threats are admin-scoped; ignore failures silently
        const { data: threats } = await supabase
          .from("threat_log").select("id").eq("resolved", false);

        const ownedHwids = new Set(hwids.map((h) => h.hwid));
        let blockedDevices = 0;
        if (ownedHwids.size) {
          const { data: bans } = await supabase
            .from("global_bans").select("ban_value")
            .eq("ban_type", "hwid").eq("is_active", true)
            .in("ban_value", [...ownedHwids]);
          blockedDevices = (bans || []).length;
        }

        // ---- time series ----
        const buckets: Record<string, DayPoint> = {};
        const days: string[] = [];
        for (let i = range - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const k = dayKey(d);
          days.push(k);
          buckets[k] = { date: k, executions: 0, visits: 0 };
        }
        executions.forEach((e) => {
          const k = dayKey(new Date(e.executed_at));
          if (buckets[k]) buckets[k].executions += 1;
        });
        logs.forEach((l) => {
          const k = dayKey(new Date(l.created_at));
          if (buckets[k]) buckets[k].visits += 1;
        });

        // ---- per-script table ----
        const rows: ScriptRow[] = (pastes || []).map((p) => {
          const ex = executions.filter((e) => e.paste_id === p.id);
          const lg = logs.filter((l) => l.paste_id === p.id);
          const dv = new Set(hwids.filter((h) => h.paste_id === p.id).map((h) => h.hwid));
          const last = ex.reduce<string | null>(
            (acc, e) => (!acc || e.executed_at > acc ? e.executed_at : acc), null);
          return {
            id: p.id,
            label: p.title || p.slug,
            executions: ex.length,
            uniqueUsers: new Set(ex.map((e) => e.roblox_user_id)).size,
            devices: dv.size,
            visits: lg.length,
            protectedScript: !!p.protection_enabled,
            lastExecuted: last,
          };
        }).sort((a, b) => b.executions - a.executions);

        const isExecutor = (t: string) => t !== "browser" && t !== "browser_view";
        const lastActivity = [
          ...executions.map((e) => e.executed_at),
          ...logs.map((l) => l.last_seen_at),
        ].sort().pop() || null;

        if (cancelled) return;

        setSeries(days.map((d) => buckets[d]));
        setScripts(rows);
        setActivityData(
          Object.entries(
            (activities || []).reduce<Record<string, number>>((acc, a) => {
              acc[a.activity_type] = (acc[a.activity_type] || 0) + 1;
              return acc;
            }, {})
          ).map(([type, count]) => ({ type, count }))
        );
        setTotals({
          pastes: pastes?.length || 0,
          protectedPastes: (pastes || []).filter((p) => p.protection_enabled).length,
          executions: executions.length,
          executionsInRange: executions.filter((e) => new Date(e.executed_at) >= since).length,
          uniqueUsers: new Set(executions.map((e) => e.roblox_user_id)).size,
          devices: ownedHwids.size,
          browserVisits: logs.filter((l) => !isExecutor(l.access_type)).length,
          executorVisits: logs.filter((l) => isExecutor(l.access_type)).length,
          uniqueIps: new Set(logs.map((l) => l.ip_address)).size,
          blockedDevices,
          threats: (threats || []).length,
          lastActivity,
        });
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [range, refreshKey]);

  const statCards = useMemo(() => ([
    { title: "Scripts", value: totals.pastes, sub: `${totals.protectedPastes} protected`, icon: FileCode },
    { title: "Executions", value: totals.executions, sub: `${totals.executionsInRange} in ${range}d`, icon: TrendingUp },
    { title: "Unique Players", value: totals.uniqueUsers, sub: "distinct Roblox IDs", icon: Users },
    { title: "Devices", value: totals.devices, sub: `${totals.blockedDevices} blocked`, icon: Cpu },
    { title: "Page Visits", value: totals.browserVisits, sub: `${totals.uniqueIps} unique IPs`, icon: Globe },
    { title: "Executor Hits", value: totals.executorVisits, sub: "in-game loads", icon: Activity },
    { title: "Open Threats", value: totals.threats, sub: "unresolved", icon: AlertTriangle },
    {
      title: "Protection Rate",
      value: `${totals.pastes ? Math.round((totals.protectedPastes / totals.pastes) * 100) : 0}%`,
      sub: fmtAgo(totals.lastActivity) + " last activity",
      icon: ShieldCheck,
    },
  ]), [totals, range]);

  const topScripts = scripts.slice(0, 6).map((s) => ({ name: s.label.slice(0, 18), count: s.executions }));

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-foreground/10 to-foreground/5 border border-border/40 flex items-center justify-center">
            <BarChart3 className="text-foreground" size={18} />
          </div>
          <div className="flex-1 min-w-[180px]">
            <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Executions, players, devices and access activity across your scripts
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border/50 bg-card/40 p-1 backdrop-blur-xl">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                  range === r ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r}d
              </button>
            ))}
          </div>
          <Button
            variant="ghost" size="sm"
            className="rounded-full gap-1.5 text-xs"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>

        <TabHelpSection {...analyticsHelp} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((stat, i) => (
            <Tilt3DCard key={i} className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-xl">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{stat.title}</p>
                  <div className="w-8 h-8 rounded-xl bg-foreground/[0.06] flex items-center justify-center">
                    <stat.icon className="h-3.5 w-3.5 text-foreground/60" />
                  </div>
                </div>
                <p className="text-3xl font-black tracking-tight">{loading ? "..." : stat.value}</p>
                <p className="mt-1 text-[10px] text-muted-foreground truncate">{stat.sub}</p>
              </div>
            </Tilt3DCard>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Tilt3DCard className="lg:col-span-2 rounded-2xl border border-border/40 bg-card/30 backdrop-blur-xl" intensity={4}>
            <div className="p-6">
              <h3 className="text-sm font-semibold mb-1">Executions vs Page Visits</h3>
              <p className="text-[10px] text-muted-foreground mb-5">Last {range} days</p>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series}>
                    <defs>
                      <linearGradient id="gExec" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.04} />
                      </linearGradient>
                      <linearGradient id="gVisit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                    <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="executions" name="Executions" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gExec)" />
                    <Area type="monotone" dataKey="visits" name="Visits" stroke="hsl(var(--secondary))" strokeWidth={2} fill="url(#gVisit)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Tilt3DCard>

          <Tilt3DCard className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-xl" intensity={6}>
            <div className="p-6">
              <h3 className="text-sm font-semibold mb-1">Top Scripts</h3>
              <p className="text-[10px] text-muted-foreground mb-5">By total executions</p>
              <div className="h-[260px]">
                {topScripts.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topScripts} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={100} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                      <Bar dataKey="count" fill="hsl(var(--foreground))" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No executions yet.</div>
                )}
              </div>
            </div>
          </Tilt3DCard>

          <Tilt3DCard className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-xl" intensity={6}>
            <div className="p-6">
              <h3 className="text-sm font-semibold mb-1">Activity Breakdown</h3>
              <p className="text-[10px] text-muted-foreground mb-5">Your platform activity distribution</p>
              <div className="h-[260px]">
                {activityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={activityData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={5} dataKey="count" nameKey="type" label={({ type, count }) => `${type}: ${count}`}>
                        {activityData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                    No activity data yet.
                  </div>
                )}
              </div>
            </div>
          </Tilt3DCard>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-xl overflow-hidden">
          <div className="p-5 border-b border-border/40">
            <h3 className="text-sm font-semibold">Per-Script Breakdown</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Executions, unique players, paired devices and visits</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Script</th>
                  <th className="px-3 py-3 font-medium text-right">Exec</th>
                  <th className="px-3 py-3 font-medium text-right">Players</th>
                  <th className="px-3 py-3 font-medium text-right">Devices</th>
                  <th className="px-3 py-3 font-medium text-right">Visits</th>
                  <th className="px-5 py-3 font-medium text-right">Last Run</th>
                </tr>
              </thead>
              <tbody>
                {scripts.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                    {loading ? "Loading..." : "No scripts yet."}
                  </td></tr>
                )}
                {scripts.map((s) => (
                  <tr key={s.id} className="border-t border-border/30 hover:bg-foreground/[0.03]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate max-w-[180px]">{s.label}</span>
                        {s.protectedScript && (
                          <span className="rounded-full bg-foreground/[0.07] px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                            Protected
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{s.executions}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{s.uniqueUsers}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{s.devices}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{s.visits}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground whitespace-nowrap">
                      <span className="inline-flex items-center gap-1"><Clock size={11} />{fmtAgo(s.lastExecuted)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Analytics;
