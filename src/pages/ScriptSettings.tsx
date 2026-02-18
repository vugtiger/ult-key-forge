import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import TabHelpSection from "@/components/onboarding/TabHelpSection";
import { scriptSettingsHelp } from "@/components/onboarding/helpContent";
import AccessMonitor from "@/components/AccessMonitor";
import GameBindingsManager from "@/components/GameBindingsManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Gamepad2, Settings } from "lucide-react";

const ScriptSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

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
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="monitor" type="button" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Access Monitor
            </TabsTrigger>
            <TabsTrigger value="games" type="button" className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4" />
              Game Bindings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monitor" className="mt-6">
            <AccessMonitor />
          </TabsContent>

          <TabsContent value="games" className="mt-6">
            <GameBindingsManager />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ScriptSettings;
