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
            <h1 className="text-2xl font-bold">Settings / Keys</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage access monitoring, bans, game bindings, and protection keys</p>
          </div>
        </div>

        <TabHelpSection {...scriptSettingsHelp} />

        <Tabs defaultValue="monitor" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4 h-12 bg-card/40 border border-border/40 rounded-xl p-1 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06),0_4px_12px_-4px_hsl(0_0%_0%/0.6),0_1px_0_0_hsl(0_0%_0%/0.4)] backdrop-blur-md">
            <TabsTrigger
              value="monitor"
              type="button"
              className="flex items-center gap-1.5 text-xs rounded-lg transition-all duration-200 data-[state=active]:bg-gradient-to-b data-[state=active]:from-primary/25 data-[state=active]:to-primary/10 data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.18),0_2px_6px_-1px_hsl(0_0%_0%/0.5),0_1px_0_0_hsl(0_0%_0%/0.3)] data-[state=active]:-translate-y-px data-[state=inactive]:hover:bg-foreground/5"
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Access Monitor Supabase</span>
              <span className="sm:hidden">Mon</span>
            </TabsTrigger>
            <TabsTrigger
              value="bans"
              type="button"
              className="flex items-center gap-1.5 text-xs rounded-lg transition-all duration-200 data-[state=active]:bg-gradient-to-b data-[state=active]:from-destructive/25 data-[state=active]:to-destructive/10 data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.18),0_2px_6px_-1px_hsl(0_0%_0%/0.5),0_1px_0_0_hsl(0_0%_0%/0.3)] data-[state=active]:-translate-y-px data-[state=inactive]:hover:bg-foreground/5"
            >
              <ShieldBan className="h-3.5 w-3.5" />
              <span>Bans</span>
            </TabsTrigger>
            <TabsTrigger
              value="games"
              type="button"
              className="flex items-center gap-1.5 text-xs rounded-lg transition-all duration-200 data-[state=active]:bg-gradient-to-b data-[state=active]:from-primary/25 data-[state=active]:to-primary/10 data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.18),0_2px_6px_-1px_hsl(0_0%_0%/0.5),0_1px_0_0_hsl(0_0%_0%/0.3)] data-[state=active]:-translate-y-px data-[state=inactive]:hover:bg-foreground/5"
            >
              <Gamepad2 className="h-3.5 w-3.5" />
              <span>Games</span>
            </TabsTrigger>
            <TabsTrigger
              value="keys"
              type="button"
              className="flex items-center gap-1.5 text-xs rounded-lg transition-all duration-200 data-[state=active]:bg-gradient-to-b data-[state=active]:from-primary/25 data-[state=active]:to-primary/10 data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.18),0_2px_6px_-1px_hsl(0_0%_0%/0.5),0_1px_0_0_hsl(0_0%_0%/0.3)] data-[state=active]:-translate-y-px data-[state=inactive]:hover:bg-foreground/5"
            >
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
