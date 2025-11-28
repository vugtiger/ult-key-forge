import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, RotateCcw } from "lucide-react";
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
    const [r, g, b] = color.split(',').map(c => parseInt(c.trim()));
    const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
    const max = Math.max(rNorm, gNorm, bNorm), min = Math.min(rNorm, gNorm, bNorm);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rNorm: h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6; break;
        case gNorm: h = ((bNorm - rNorm) / d + 2) / 6; break;
        case bNorm: h = ((rNorm - gNorm) / d + 4) / 6; break;
      }
    }
    const hsl = `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    root.style.setProperty('--foreground', hsl);
    root.style.setProperty('--card-foreground', hsl);
    root.style.setProperty('--popover-foreground', hsl);
    root.style.setProperty('--sidebar-foreground', hsl);
  };

  const handleSaveTheme = async () => {
    const rgbRegex = /^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/;
    if (!rgbRegex.test(themeColor)) {
      toast({ title: "Invalid format", description: "Please use RGB format: 255, 255, 255", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from('user_themes').update({ primary_color: themeColor }).eq('user_id', user.id);
      if (error) throw error;
      applyTheme(themeColor);
      toast({ title: "Success!", description: "Text color updated successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setThemeColor("255, 255, 255");
    const root = document.documentElement;
    root.style.removeProperty('--foreground');
    root.style.removeProperty('--card-foreground');
    root.style.removeProperty('--popover-foreground');
    root.style.removeProperty('--sidebar-foreground');
  };

  if (fetching) return <DashboardLayout><div className="text-center py-12">Loading settings...</div></DashboardLayout>;

  const colorPresets = [
    { name: "White", color: "255, 255, 255", bg: "bg-white" },
    { name: "Cyan", color: "0, 255, 255", bg: "bg-cyan-500" },
    { name: "Magenta", color: "255, 0, 255", bg: "bg-fuchsia-500" },
    { name: "Green", color: "0, 255, 0", bg: "bg-green-500" },
    { name: "Yellow", color: "255, 255, 0", bg: "bg-yellow-500" },
    { name: "Orange", color: "255, 165, 0", bg: "bg-orange-500" },
    { name: "Red", color: "255, 50, 50", bg: "bg-red-500" },
    { name: "Blue", color: "100, 150, 255", bg: "bg-blue-500" },
    { name: "Purple", color: "180, 100, 255", bg: "bg-purple-500" },
    { name: "Pink", color: "255, 150, 200", bg: "bg-pink-400" },
    { name: "Lime", color: "180, 255, 100", bg: "bg-lime-400" },
    { name: "Teal", color: "0, 200, 200", bg: "bg-teal-500" },
    { name: "Gold", color: "255, 215, 0", bg: "bg-yellow-400" },
    { name: "Silver", color: "192, 192, 192", bg: "bg-gray-400" },
    { name: "Coral", color: "255, 127, 80", bg: "bg-orange-400" },
    { name: "Sky", color: "135, 206, 235", bg: "bg-sky-400" },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Customize your text color (glow effects stay white)</p>
        </div>
        <Card className="p-6 cyber-border bg-card/50 backdrop-blur-xl">
          <h2 className="text-2xl font-semibold mb-6">Text Color</h2>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="themeColor">Text Color (RGB)</Label>
              <Input id="themeColor" placeholder="e.g., 255, 100, 50" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="bg-input" />
              <p className="text-sm text-muted-foreground">Only changes text colors. Glow effects stay white.</p>
            </div>
            <div className="p-4 rounded-lg border border-border bg-input/30">
              <p className="text-sm mb-2 text-muted-foreground">Preview:</p>
              <div className="p-4 rounded-md bg-background border border-border" style={{ color: `rgb(${themeColor})` }}>
                <p className="text-lg font-bold">Sample Text Preview</p>
                <p className="text-sm">This is how your text will look.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleSaveTheme} disabled={loading} className="flex-1 cyber-glow" size="lg">
                <Save className="mr-2" size={20} />{loading ? "Saving..." : "Save Changes"}
              </Button>
              <Button onClick={handleReset} variant="outline" size="lg"><RotateCcw className="mr-2" size={20} />Reset</Button>
            </div>
          </div>
        </Card>
        <Card className="p-6 bg-card/30 border-border/50">
          <h3 className="text-lg font-semibold mb-4">Color Presets</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {colorPresets.map((preset) => (
              <Button key={preset.name} variant="outline" onClick={() => setThemeColor(preset.color)} className="justify-start h-auto py-2 px-3">
                <div className={`w-4 h-4 rounded-full ${preset.bg} mr-2 flex-shrink-0`} />
                <span className="text-xs truncate">{preset.name}</span>
              </Button>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
