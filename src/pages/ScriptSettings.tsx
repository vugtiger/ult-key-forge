import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import TabHelpSection from "@/components/onboarding/TabHelpSection";
import { scriptSettingsHelp } from "@/components/onboarding/helpContent";
import AccessMonitor from "@/components/AccessMonitor";
import GameBindingsManager from "@/components/GameBindingsManager";
import BannedUsersTab from "@/components/access-monitor/BannedUsersTab";
import BannedIPsTab from "@/components/access-monitor/BannedIPsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Gamepad2, Settings, ShieldBan, Globe } from "lucide-react";

const ScriptSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [bannedIps, setBannedIps] = useState<any[]>([]);
  const [bansLoading, setBansLoading] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }
    setLoading(false);
    fetchBans();
  };

  const fetchBans = async () => {
    setBansLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('owner-bans', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.data) {
        setBannedUsers(response.data.banned_users || []);
        setBannedIps(response.data.banned_ips || []);
      }
    } catch (error) {
      console.error('Error fetching bans:', error);
    } finally {
      setBansLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Script Settings</h1>
            <p className="text-muted-foreground">Manage access monitoring and game restrictions for your scripts</p>
          </div>
        </div>

        <TabHelpSection {...scriptSettingsHelp} />

        {/* Tabs */}
        <Tabs defaultValue="monitor" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="monitor" type="button" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Access Monitor</span>
              <span className="sm:hidden">Monitor</span>
            </TabsTrigger>
            <TabsTrigger value="games" type="button" className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4" />
              <span className="hidden sm:inline">Game Bindings</span>
              <span className="sm:hidden">Games</span>
            </TabsTrigger>
            <TabsTrigger value="banned-users" type="button" className="flex items-center gap-2">
              <ShieldBan className="h-4 w-4" />
              <span className="hidden sm:inline">Banned Users</span>
              <span className="sm:hidden">Users</span>
              {bannedUsers.length > 0 && (
                <span className="ml-1 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0 rounded-full">{bannedUsers.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="banned-ips" type="button" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">Banned IPs</span>
              <span className="sm:hidden">IPs</span>
              {bannedIps.length > 0 && (
                <span className="ml-1 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0 rounded-full">{bannedIps.length}</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monitor" className="mt-6">
            <AccessMonitor />
          </TabsContent>

          <TabsContent value="games" className="mt-6">
            <GameBindingsManager />
          </TabsContent>

          <TabsContent value="banned-users" className="mt-6">
            <BannedUsersTab users={bannedUsers} loading={bansLoading} />
          </TabsContent>

          <TabsContent value="banned-ips" className="mt-6">
            <BannedIPsTab ips={bannedIps} loading={bansLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ScriptSettings;
