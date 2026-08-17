import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, RotateCcw, Sparkles, Type, Languages, Settings as SettingsIcon, Palette } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import TabHelpSection from "@/components/onboarding/TabHelpSection";
import { settingsHelp } from "@/components/onboarding/helpContent";
import GoogleTranslate from "@/components/GoogleTranslate";
import SessionManager from "@/components/SessionManager";
import AccountInfo from "@/components/AccountInfo";
import DashboardCustomizer from "@/components/DashboardCustomizer";

const Settings = () => {
  const [themeColor, setThemeColor] = useState("255, 255, 255");
  const [neonEnabled, setNeonEnabled] = useState(false);
  const [ultLuaStyle, setUltLuaStyle] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const { toast } = useToast();

  useEffect(() => { fetchTheme(); }, []);

  const fetchTheme = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from('user_themes').select('primary_color, neon_enabled, ult_lua_style').eq('user_id', user.id).single();
      if (error) throw error;
      if (data) {
        setThemeColor(data.primary_color);
        setNeonEnabled(data.neon_enabled || false);
        setUltLuaStyle(data.ult_lua_style || false);
        applyTheme(data.primary_color, data.neon_enabled || false, data.ult_lua_style || false);
      }
    } catch (error: any) { console.error('Error fetching theme:', error); }
    finally { setFetching(false); }
  };

  const applyTheme = (color: string, neon: boolean, ultStyle: boolean) => {
    const root = document.documentElement;
    const isDefaultWhite = color.replace(/\s/g, '') === '255,255,255';
    if (isDefaultWhite) {
      root.style.removeProperty('--foreground');
      root.style.removeProperty('--card-foreground');
      root.style.removeProperty('--popover-foreground');
      root.style.removeProperty('--sidebar-foreground');
    }
    const [r, g, b] = color.split(',').map(c => parseInt(c.trim()));
    const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
    const max = Math.max(rNorm, gNorm, bNorm), min = Math.min(rNorm, gNorm, bNorm);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rNorm: h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6; break;
        case gNorm: h = ((bNorm - rNorm) / d + 2) / 6; break;
        case bNorm: h = ((rNorm - gNorm) / d + 4) / 6; break;
      }
    }
    // Clamp lightness so text stays readable on the light background.
    const safeL = Math.min(Math.round(l * 100), 42);
    const hsl = `${Math.round(h * 360)} ${Math.round(s * 100)}% ${safeL}%`;
    if (!isDefaultWhite) {
      root.style.setProperty('--foreground', hsl);
      root.style.setProperty('--card-foreground', hsl);
      root.style.setProperty('--popover-foreground', hsl);
      root.style.setProperty('--sidebar-foreground', hsl);
    }
    if (neon) {
      root.style.setProperty('--neon-color', `rgb(${color})`);
      root.style.setProperty('--neon-color-glow', `rgba(${color}, 0.6)`);
      root.classList.add('neon-text-enabled');
    } else {
      root.style.removeProperty('--neon-color');
      root.style.removeProperty('--neon-color-glow');
      root.classList.remove('neon-text-enabled');
    }
    if (ultStyle) root.classList.add('ult-lua-style-enabled');
    else root.classList.remove('ult-lua-style-enabled');
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
      const { error } = await supabase.from('user_themes').update({ primary_color: themeColor, neon_enabled: neonEnabled, ult_lua_style: ultLuaStyle }).eq('user_id', user.id);
      if (error) throw error;
      await supabase.from('user_activity').insert({ user_id: user.id, activity_type: 'theme_change', activity_data: { color: themeColor, neon: neonEnabled, ultLua: ultLuaStyle } });
      applyTheme(themeColor, neonEnabled, ultLuaStyle);
      toast({ title: "Success!", description: "Theme settings updated successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleReset = () => {
    setThemeColor("255, 255, 255"); setNeonEnabled(false); setUltLuaStyle(false);
    const root = document.documentElement;
    root.style.removeProperty('--foreground'); root.style.removeProperty('--card-foreground');
    root.style.removeProperty('--popover-foreground'); root.style.removeProperty('--sidebar-foreground');
    root.style.removeProperty('--neon-color'); root.style.removeProperty('--neon-color-glow');
    root.classList.remove('neon-text-enabled'); root.classList.remove('ult-lua-style-enabled');
  };

  if (fetching) return <DashboardLayout><div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div></DashboardLayout>;

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
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/12 flex items-center justify-center">
            <SettingsIcon className="text-primary" size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage your account and preferences</p>
          </div>
        </div>

        <TabHelpSection {...settingsHelp} />

        {/* Language */}
        <div className="rounded-xl border border-primary/10 bg-card/20 p-5 backdrop-blur-xl">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Languages className="w-4 h-4 text-primary" /> Language
          </h2>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">Select your preferred language:</p>
            <GoogleTranslate />
          </div>
        </div>

        <AccountInfo />

        {/* Text Color */}
        <div className="rounded-xl border border-primary/10 bg-card/20 p-5 backdrop-blur-xl space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" /> Text Color
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="themeColor" className="text-xs">Text Color (RGB)</Label>
            <Input id="themeColor" placeholder="e.g., 255, 100, 50" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="bg-background/50 h-9 text-sm" />
            <p className="text-[10px] text-muted-foreground">Only changes text colors. Glow effects stay white.</p>
          </div>
          <div className="rounded-lg border border-primary/8 bg-background/20 p-3">
            <p className="text-[10px] text-muted-foreground mb-1.5">Preview:</p>
            <div className="p-3 rounded-lg bg-background/50 border border-primary/5" style={{
              color: `rgb(${themeColor})`,
              textShadow: neonEnabled ? `0 0 5px rgb(${themeColor}), 0 0 10px rgb(${themeColor}), 0 0 20px rgba(${themeColor}, 0.6)` : 'none',
              fontWeight: ultLuaStyle ? 'bold' : 'normal',
              fontStyle: ultLuaStyle ? 'italic' : 'normal'
            }}>
              <p className="text-sm font-bold">Sample Text Preview</p>
              <p className="text-xs">This is how your text will look.</p>
            </div>
          </div>
        </div>

        {/* Text Style */}
        <div className="rounded-xl border border-primary/10 bg-card/20 p-5 backdrop-blur-xl space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Type className="w-4 h-4 text-primary" /> Text Style
          </h2>
          <div className="flex items-center justify-between p-3 rounded-lg border border-primary/8 bg-background/20">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-primary" />
              <div>
                <Label htmlFor="neon" className="text-xs font-medium">Neon Effect</Label>
                <p className="text-[10px] text-muted-foreground">Add a glowing neon effect to text</p>
              </div>
            </div>
            <Switch id="neon" checked={neonEnabled} onCheckedChange={setNeonEnabled} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-primary/8 bg-background/20">
            <div className="flex items-center gap-2.5">
              <Type className="w-4 h-4 text-primary" />
              <div>
                <Label htmlFor="ultLua" className="text-xs font-medium">ULT LUA Style</Label>
                <p className="text-[10px] text-muted-foreground">Bold italic text like the ULT LUA logo</p>
              </div>
            </div>
            <Switch id="ultLua" checked={ultLuaStyle} onCheckedChange={setUltLuaStyle} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={handleSaveTheme} disabled={loading} className="flex-1 h-9 text-xs rounded-lg" size="sm">
              <Save className="mr-1.5" size={14} />{loading ? "Saving..." : "Save Changes"}
            </Button>
            <Button onClick={handleReset} variant="outline" size="sm" className="h-9 text-xs rounded-lg border-primary/10">
              <RotateCcw className="mr-1.5" size={14} />Reset
            </Button>
          </div>
        </div>

        {/* Dashboard Layout Customizer */}
        <DashboardCustomizer />

        {/* Color Presets */}
        <div className="rounded-xl border border-primary/10 bg-card/20 p-5 backdrop-blur-xl">
          <h3 className="text-sm font-semibold mb-3">Color Presets</h3>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {colorPresets.map((preset) => (
              <button key={preset.name} onClick={() => setThemeColor(preset.color)} className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-primary/8 transition-colors" title={preset.name}>
                <div className={`w-6 h-6 rounded-full ${preset.bg} border border-border/20`} />
                <span className="text-[9px] text-muted-foreground truncate w-full text-center">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/50 text-center pb-4">
          Theme settings are reset when you log out and restored when you log back in.
        </p>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
