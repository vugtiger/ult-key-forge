import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import TabHelpSection from "@/components/onboarding/TabHelpSection";
import { scriptSettingsHelp } from "@/components/onboarding/helpContent";
import AccessMonitor from "@/components/AccessMonitor";
import GameBindingsManager from "@/components/GameBindingsManager";
import OwnerBansManager from "@/components/OwnerBansManager";
import ProtectionKeyManager from "@/components/ProtectionKeyManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Gamepad2, Settings, ShieldBan, Key } from "lucide-react";

const ScriptSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/12 flex items-center justify-center">
            <Settings className="text-primary" size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Script Settings</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage access monitoring, bans, game bindings, and protection keys</p>
          </div>
        </div>

        <TabHelpSection {...scriptSettingsHelp} />

        <Tabs defaultValue="monitor" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4 h-9 bg-card/30 border border-primary/10 rounded-lg p-0.5">
            <TabsTrigger value="monitor" type="button" className="flex items-center gap-1.5 text-xs rounded-md data-[state=active]:bg-primary/15 data-[state=active]:text-foreground">
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Monitor</span>
              <span className="sm:hidden">Mon</span>
            </TabsTrigger>
            <TabsTrigger value="bans" type="button" className="flex items-center gap-1.5 text-xs rounded-md data-[state=active]:bg-destructive/15 data-[state=active]:text-foreground">
              <ShieldBan className="h-3.5 w-3.5" />
              <span>Bans</span>
            </TabsTrigger>
            <TabsTrigger value="games" type="button" className="flex items-center gap-1.5 text-xs rounded-md data-[state=active]:bg-primary/15 data-[state=active]:text-foreground">
              <Gamepad2 className="h-3.5 w-3.5" />
              <span>Games</span>
            </TabsTrigger>
            <TabsTrigger value="keys" type="button" className="flex items-center gap-1.5 text-xs rounded-md data-[state=active]:bg-primary/15 data-[state=active]:text-foreground">
              <Key className="h-3.5 w-3.5" />
              <span>Keys</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="monitor" className="mt-4"><AccessMonitor /></TabsContent>
          <TabsContent value="bans" className="mt-4"><OwnerBansManager /></TabsContent>
          <TabsContent value="games" className="mt-4"><GameBindingsManager /></TabsContent>
          <TabsContent value="keys" className="mt-4"><ProtectionKeyManager /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ScriptSettings;
