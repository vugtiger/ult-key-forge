import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import TabHelpSection from "@/components/onboarding/TabHelpSection";
import { analyticsHelp } from "@/components/onboarding/helpContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Activity, Users, FileCode, TrendingUp } from "lucide-react";

interface ExecutionData {
  date: string;
  count: number;
}

interface PasteStats {
  total_pastes: number;
  protected_pastes: number;
  total_executions: number;
}

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

        // Fetch paste stats
        const { data: pastes } = await supabase
          .from('pastes')
          .select('id, protection_enabled')
          .eq('user_id', user.id);

        const totalPastes = pastes?.length || 0;
        const protectedPastes = pastes?.filter(p => p.protection_enabled)?.length || 0;

        // Fetch executions for user's pastes
        const pasteIds = pastes?.map(p => p.id) || [];
        let totalExecutions = 0;
        let executionsByDate: Record<string, number> = {};

        if (pasteIds.length > 0) {
          const { data: executions } = await supabase
            .from('paste_executions')
            .select('executed_at')
            .in('paste_id', pasteIds);

          totalExecutions = executions?.length || 0;

          // Group by date
          executions?.forEach(exec => {
            const date = new Date(exec.executed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            executionsByDate[date] = (executionsByDate[date] || 0) + 1;
          });
        }

        // Convert to array for chart
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          last7Days.push({
            date: dateStr,
            count: executionsByDate[dateStr] || 0
          });
        }

        // Fetch activity data
        const { data: activities } = await supabase
          .from('user_activity')
          .select('activity_type')
          .eq('user_id', user.id);

        const activityCounts: Record<string, number> = {};
        activities?.forEach(a => {
          activityCounts[a.activity_type] = (activityCounts[a.activity_type] || 0) + 1;
        });

        setPasteStats({ total_pastes: totalPastes, protected_pastes: protectedPastes, total_executions: totalExecutions });
        setExecutionData(last7Days);
        setActivityData(Object.entries(activityCounts).map(([type, count]) => ({ type, count })));
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const statCards = [
    { title: "Total Pastes", value: pasteStats.total_pastes, icon: FileCode, color: "text-primary" },
    { title: "Protected Pastes", value: pasteStats.protected_pastes, icon: Activity, color: "text-primary" },
    { title: "Total Executions", value: pasteStats.total_executions, icon: TrendingUp, color: "text-primary" },
    { title: "Protection Rate", value: `${pasteStats.total_pastes > 0 ? Math.round((pasteStats.protected_pastes / pasteStats.total_pastes) * 100) : 0}%`, icon: Users, color: "text-primary" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Track your script executions and usage</p>
        </div>

        <TabHelpSection {...analyticsHelp} />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? "..." : stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Executions Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Script Executions (Last 7 Days)</CardTitle>
              <CardDescription>Number of times your scripts were executed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={executionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Execution Trend</CardTitle>
              <CardDescription>Track your script usage over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={executionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Activity Breakdown */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Activity Breakdown</CardTitle>
              <CardDescription>Your activity distribution across the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {activityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={activityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="type"
                        label={({ type, count }) => `${type}: ${count}`}
                      >
                        {activityData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No activity data yet. Start using the platform to see your activity breakdown!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Analytics;
