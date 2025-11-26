import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

const Settings = () => {
  const [themeColor, setThemeColor] = useState("255, 255, 255");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchTheme();
  }, []);

  const fetchTheme = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_themes')
        .select('primary_color')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      if (data) {
        setThemeColor(data.primary_color);
        applyTheme(data.primary_color);
      }
    } catch (error: any) {
      console.error('Error fetching theme:', error);
    } finally {
      setFetching(false);
    }
  };

  const applyTheme = (color: string) => {
    const root = document.documentElement;
    root.style.setProperty('--cyber-glow', color);
    root.style.setProperty('--cyber-glow-intense', color);
  };

  const handleSaveTheme = async () => {
    // Validate RGB format
    const rgbRegex = /^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/;
    if (!rgbRegex.test(themeColor)) {
      toast({
        title: "Invalid format",
        description: "Please use RGB format: 255, 255, 255",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('user_themes')
        .update({ primary_color: themeColor })
        .eq('user_id', user.id);

      if (error) throw error;

      applyTheme(themeColor);

      toast({
        title: "Success!",
        description: "Theme updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">Loading settings...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Customize your experience
          </p>
        </div>

        <Card className="p-6 cyber-border bg-card/50 backdrop-blur-xl">
          <h2 className="text-2xl font-semibold mb-6">Theme Customization</h2>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="themeColor">Primary Accent Color (RGB)</Label>
              <Input
                id="themeColor"
                placeholder="e.g., 255, 100, 50"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="bg-input"
              />
              <p className="text-sm text-muted-foreground">
                Enter RGB values to customize the glow and accent colors throughout the site
              </p>
            </div>

            <div className="p-4 rounded-lg border border-border bg-input/30">
              <p className="text-sm mb-2 text-muted-foreground">Preview:</p>
              <div 
                className="h-16 rounded-md cyber-glow"
                style={{ 
                  backgroundColor: `rgb(${themeColor})`,
                  boxShadow: `0 0 20px rgba(${themeColor}, 0.5)`
                }}
              />
            </div>

            <Button
              onClick={handleSaveTheme}
              disabled={loading}
              className="w-full cyber-glow"
              size="lg"
            >
              <Save className="mr-2" size={20} />
              {loading ? "Saving..." : "Save Theme"}
            </Button>
          </div>
        </Card>

        <Card className="p-6 bg-card/30 border-border/50">
          <h3 className="text-lg font-semibold mb-3">Color Suggestions:</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => setThemeColor("255, 255, 255")}
              className="justify-start"
            >
              <div className="w-4 h-4 rounded-full bg-white mr-2" />
              White (Default)
            </Button>
            <Button
              variant="outline"
              onClick={() => setThemeColor("0, 255, 255")}
              className="justify-start"
            >
              <div className="w-4 h-4 rounded-full bg-cyan-500 mr-2" />
              Cyan
            </Button>
            <Button
              variant="outline"
              onClick={() => setThemeColor("255, 0, 255")}
              className="justify-start"
            >
              <div className="w-4 h-4 rounded-full bg-fuchsia-500 mr-2" />
              Magenta
            </Button>
            <Button
              variant="outline"
              onClick={() => setThemeColor("0, 255, 0")}
              className="justify-start"
            >
              <div className="w-4 h-4 rounded-full bg-green-500 mr-2" />
              Green
            </Button>
            <Button
              variant="outline"
              onClick={() => setThemeColor("255, 255, 0")}
              className="justify-start"
            >
              <div className="w-4 h-4 rounded-full bg-yellow-500 mr-2" />
              Yellow
            </Button>
            <Button
              variant="outline"
              onClick={() => setThemeColor("255, 100, 0")}
              className="justify-start"
            >
              <div className="w-4 h-4 rounded-full bg-orange-500 mr-2" />
              Orange
            </Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
