import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import TabHelpSection from "@/components/onboarding/TabHelpSection";
import { analyticsHelp } from "@/components/onboarding/helpContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Activity, Users, FileCode, TrendingUp, BarChart3 } from "lucide-react";

interface ExecutionData { date: string; count: number; }
interface PasteStats { total_pastes: number; protected_pastes: number; total_executions: number; }

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

const Analytics = () => {
  const [executionData, setExecutionData] = useState<ExecutionData[]>([]);
  const [pasteStats, setPasteStats] = useState<PasteStats>({ total_pastes: 0, protected_pastes: 0, total_executions: 0 });
  const [activityData, setActivityData] = useState<{ type: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: pastes } = await supabase.from('pastes').select('id, protection_enabled').eq('user_id', user.id);
        const totalPastes = pastes?.length || 0;
        const protectedPastes = pastes?.filter(p => p.protection_enabled)?.length || 0;
        const pasteIds = pastes?.map(p => p.id) || [];
        let totalExecutions = 0;
        let executionsByDate: Record<string, number> = {};
        if (pasteIds.length > 0) {
          const { data: executions } = await supabase.from('paste_executions').select('executed_at').in('paste_id', pasteIds);
          totalExecutions = executions?.length || 0;
          executions?.forEach(exec => {
            const date = new Date(exec.executed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            executionsByDate[date] = (executionsByDate[date] || 0) + 1;
          });
        }
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date(); date.setDate(date.getDate() - i);
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          last7Days.push({ date: dateStr, count: executionsByDate[dateStr] || 0 });
        }
        const { data: activities } = await supabase.from('user_activity').select('activity_type').eq('user_id', user.id);
        const activityCounts: Record<string, number> = {};
        activities?.forEach(a => { activityCounts[a.activity_type] = (activityCounts[a.activity_type] || 0) + 1; });
        setPasteStats({ total_pastes: totalPastes, protected_pastes: protectedPastes, total_executions: totalExecutions });
        setExecutionData(last7Days);
        setActivityData(Object.entries(activityCounts).map(([type, count]) => ({ type, count })));
      } catch (error) { console.error('Error fetching analytics:', error); }
      finally { setLoading(false); }
    };
    fetchAnalytics();
  }, []);

  const statCards = [
    { title: "Total Pastes", value: pasteStats.total_pastes, icon: FileCode },
    { title: "Protected", value: pasteStats.protected_pastes, icon: Activity },
    { title: "Executions", value: pasteStats.total_executions, icon: TrendingUp },
    { title: "Protection Rate", value: `${pasteStats.total_pastes > 0 ? Math.round((pasteStats.protected_pastes / pasteStats.total_pastes) * 100) : 0}%`, icon: Users },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/12 flex items-center justify-center">
            <BarChart3 className="text-primary" size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Track your script executions and usage</p>
          </div>
        </div>

        <TabHelpSection {...analyticsHelp} />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {statCards.map((stat, i) => (
            <div key={i} className="rounded-xl border border-primary/10 bg-card/20 p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{stat.title}</p>
                <stat.icon className="h-4 w-4 text-primary/60" />
              </div>
              <p className="text-2xl font-bold">{loading ? "..." : stat.value}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-xl border border-primary/10 bg-card/20 p-5 backdrop-blur-xl">
            <h3 className="text-sm font-semibold mb-1">Executions (7 Days)</h3>
            <p className="text-[10px] text-muted-foreground mb-4">Number of times your scripts were executed</p>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={executionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-primary/10 bg-card/20 p-5 backdrop-blur-xl">
            <h3 className="text-sm font-semibold mb-1">Execution Trend</h3>
            <p className="text-[10px] text-muted-foreground mb-4">Track your script usage over time</p>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={executionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-xl border border-primary/10 bg-card/20 p-5 backdrop-blur-xl">
            <h3 className="text-sm font-semibold mb-1">Activity Breakdown</h3>
            <p className="text-[10px] text-muted-foreground mb-4">Your activity distribution across the platform</p>
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
                  No activity data yet. Start using the platform to see your activity breakdown!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Analytics;
