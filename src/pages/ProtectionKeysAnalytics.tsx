import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Key, ShieldCheck, ShieldX, Activity, Users, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Tilt3DCard from "@/components/Tilt3DCard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface Paste { id: string; title: string | null; slug: string; }
interface PKey {
  id: string;
  key_value: string;
  is_active: boolean;
  bound_roblox_user_id: string | null;
  bound_roblox_username: string | null;
  bound_at: string | null;
  expires_at: string | null;
  created_at: string;
}
interface PEvent {
  id: string;
  event_type: string;
  roblox_username: string | null;
  roblox_user_id: string | null;
  created_at: string;
  ip_address: string | null;
}

const COLORS = ['hsl(var(--foreground))', 'hsl(var(--muted-foreground))', 'hsl(var(--destructive))', 'hsl(var(--border))'];

const ProtectionKeysAnalytics = () => {
  const [pastes, setPastes] = useState<Paste[]>([]);
  const [selectedPaste, setSelectedPaste] = useState<string>("all");
  const [keys, setKeys] = useState<PKey[]>([]);
  const [events, setEvents] = useState<PEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: ps } = await supabase.from("pastes").select("id, title, slug").eq("user_id", user.id);
      setPastes(ps || []);
    };
    load();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: ps } = await supabase.from("pastes").select("id").eq("user_id", user.id);
        const ids = (ps || []).map(p => p.id);
        if (ids.length === 0) { setKeys([]); setEvents([]); return; }
        const filterIds = selectedPaste === "all" ? ids : [selectedPaste];

        const [{ data: ks }, { data: evs }] = await Promise.all([
          supabase.from("protection_keys").select("*").in("paste_id", filterIds).order("created_at", { ascending: false }),
          supabase.from("protection_key_events").select("*").in("paste_id", filterIds).order("created_at", { ascending: false }).limit(200),
        ]);
        setKeys((ks || []) as PKey[]);
        setEvents((evs || []) as PEvent[]);
      } finally { setLoading(false); }
    };
    fetchData();
  }, [selectedPaste]);

  const totalKeys = keys.length;
  const activeKeys = keys.filter(k => k.is_active).length;
  const boundKeys = keys.filter(k => k.bound_roblox_user_id).length;
  const expiredKeys = keys.filter(k => k.expires_at && new Date(k.expires_at) < new Date()).length;

  // Events grouped per day (last 7)
  const last7: { date: string; redeem: number; kick: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    last7.push({ date: label, redeem: 0, kick: 0 });
  }
  events.forEach(e => {
    const label = new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const bucket = last7.find(b => b.date === label);
    if (!bucket) return;
    if (e.event_type === "redeem" || e.event_type === "validated") bucket.redeem++;
    else if (e.event_type === "kick" || e.event_type === "spoof_blocked" || e.event_type === "invalid_key") bucket.kick++;
  });

  const pie = [
    { name: "Active", value: activeKeys },
    { name: "Bound", value: boundKeys },
    { name: "Expired", value: expiredKeys },
    { name: "Inactive", value: Math.max(0, totalKeys - activeKeys) },
  ].filter(s => s.value > 0);

  const stats = [
    { label: "Total Keys", value: totalKeys, icon: Key },
    { label: "Active", value: activeKeys, icon: ShieldCheck },
    { label: "Bound to Roblox", value: boundKeys, icon: Users },
    { label: "Expired", value: expiredKeys, icon: Clock },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-foreground/10 to-foreground/5 border border-border/40 flex items-center justify-center">
            <Key className="text-foreground" size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Protection Key Analytics</h1>
            <p className="text-xs text-muted-foreground mt-0.5">_G.ScriptKey usage, bindings, and threats</p>
          </div>
        </div>

        {/* Paste filter */}
        <div className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-xl p-4 no-neon">
          <Select value={selectedPaste} onValueChange={setSelectedPaste}>
            <SelectTrigger className="w-full md:w-80"><SelectValue placeholder="Filter by paste" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All pastes</SelectItem>
              {pastes.map(p => (<SelectItem key={p.id} value={p.id}>{p.title || p.slug}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s, i) => (
            <Tilt3DCard key={i} className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-xl">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{s.label}</p>
                  <div className="w-8 h-8 rounded-xl bg-foreground/[0.06] flex items-center justify-center">
                    <s.icon className="h-3.5 w-3.5 text-foreground/60" />
                  </div>
                </div>
                <p className="text-3xl font-black tracking-tight">{loading ? "..." : s.value}</p>
              </div>
            </Tilt3DCard>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Tilt3DCard className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-xl" intensity={6}>
            <div className="p-6">
              <h3 className="text-sm font-semibold mb-1">Redemptions vs Kicks (7d)</h3>
              <p className="text-[10px] text-muted-foreground mb-5">Validated keys vs blocked attempts</p>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={last7}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                    <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }} />
                    <Bar dataKey="redeem" fill="hsl(var(--foreground))" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="kick" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Tilt3DCard>

          <Tilt3DCard className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-xl" intensity={6}>
            <div className="p-6">
              <h3 className="text-sm font-semibold mb-1">Key Status Breakdown</h3>
              <p className="text-[10px] text-muted-foreground mb-5">Distribution of all generated keys</p>
              <div className="h-[260px]">
                {pie.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pie} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={5} dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`}>
                        {pie.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No keys yet.</div>
                )}
              </div>
            </div>
          </Tilt3DCard>
        </div>

        {/* Bound keys table */}
        <div className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-xl p-6 no-neon">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Users size={14} /> Key → Roblox Account Bindings</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border/30">
                  <th className="py-2 pr-4 font-medium">Key</th>
                  <th className="py-2 pr-4 font-medium">Roblox User</th>
                  <th className="py-2 pr-4 font-medium">Bound At</th>
                  <th className="py-2 pr-4 font-medium">Expires</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {keys.filter(k => k.bound_roblox_user_id).slice(0, 50).map(k => {
                  const expired = k.expires_at && new Date(k.expires_at) < new Date();
                  return (
                    <tr key={k.id} className="border-b border-border/10">
                      <td className="py-2 pr-4 font-mono">{k.key_value.slice(0, 16)}...</td>
                      <td className="py-2 pr-4">{k.bound_roblox_username || k.bound_roblox_user_id}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{k.bound_at ? new Date(k.bound_at).toLocaleString() : "-"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{k.expires_at ? new Date(k.expires_at).toLocaleDateString() : "Never"}</td>
                      <td className="py-2">
                        {!k.is_active ? <span className="text-destructive">Disabled</span>
                          : expired ? <span className="text-destructive">Expired</span>
                          : <span className="text-foreground">Active</span>}
                      </td>
                    </tr>
                  );
                })}
                {keys.filter(k => k.bound_roblox_user_id).length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No keys have been redeemed yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent events */}
        <div className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-xl p-6 no-neon">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Activity size={14} /> Recent Events</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {events.slice(0, 50).map(e => {
              const isBad = ["kick", "spoof_blocked", "invalid_key"].includes(e.event_type);
              return (
                <div key={e.id} className="flex items-center justify-between text-xs p-3 rounded-lg bg-background/40 border border-border/20">
                  <div className="flex items-center gap-3">
                    {isBad ? <ShieldX size={14} className="text-destructive" /> : <ShieldCheck size={14} className="text-foreground" />}
                    <div>
                      <p className="font-medium">{e.event_type}</p>
                      <p className="text-muted-foreground text-[10px]">{e.roblox_username || e.roblox_user_id || "unknown"} · {e.ip_address || "no ip"}</p>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-[10px]">{new Date(e.created_at).toLocaleString()}</p>
                </div>
              );
            })}
            {events.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No events yet.</p>}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProtectionKeysAnalytics;
