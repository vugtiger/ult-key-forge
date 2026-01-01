import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, RotateCcw, Sparkles, Type } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import TwoFactorAuth from "@/components/TwoFactorAuth";
import SessionManager from "@/components/SessionManager";
import AccountInfo from "@/components/AccountInfo";

const Settings = () => {
  const [themeColor, setThemeColor] = useState("255, 255, 255");
  const [neonEnabled, setNeonEnabled] = useState(false);
  const [ultLuaStyle, setUltLuaStyle] = useState(false);
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
        .select('primary_color, neon_enabled, ult_lua_style')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      if (data) {
        setThemeColor(data.primary_color);
        setNeonEnabled(data.neon_enabled || false);
        setUltLuaStyle(data.ult_lua_style || false);
        applyTheme(data.primary_color, data.neon_enabled || false, data.ult_lua_style || false);
      }
    } catch (error: any) {
      console.error('Error fetching theme:', error);
    } finally {
      setFetching(false);
    }
  };

  const applyTheme = (color: string, neon: boolean, ultStyle: boolean) => {
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
    
    // Apply neon effect
    if (neon) {
      root.style.setProperty('--neon-color', `rgb(${color})`);
      root.style.setProperty('--neon-color-glow', `rgba(${color}, 0.6)`);
      root.classList.add('neon-text-enabled');
    } else {
      root.style.removeProperty('--neon-color');
      root.style.removeProperty('--neon-color-glow');
      root.classList.remove('neon-text-enabled');
    }
    
    // Apply ULT LUA style (bold italic)
    if (ultStyle) {
      root.classList.add('ult-lua-style-enabled');
    } else {
      root.classList.remove('ult-lua-style-enabled');
    }
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
      
      const { error } = await supabase
        .from('user_themes')
        .update({ 
          primary_color: themeColor,
          neon_enabled: neonEnabled,
          ult_lua_style: ultLuaStyle
        })
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      // Log activity for password reset verification
      await supabase.from('user_activity').insert({
        user_id: user.id,
        activity_type: 'theme_change',
        activity_data: { color: themeColor, neon: neonEnabled, ultLua: ultLuaStyle }
      });
      
      applyTheme(themeColor, neonEnabled, ultLuaStyle);
      toast({ title: "Success!", description: "Theme settings updated successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setThemeColor("255, 255, 255");
    setNeonEnabled(false);
    setUltLuaStyle(false);
    const root = document.documentElement;
    root.style.removeProperty('--foreground');
    root.style.removeProperty('--card-foreground');
    root.style.removeProperty('--popover-foreground');
    root.style.removeProperty('--sidebar-foreground');
    root.style.removeProperty('--neon-color');
    root.style.removeProperty('--neon-color-glow');
    root.classList.remove('neon-text-enabled');
    root.classList.remove('ult-lua-style-enabled');
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
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>

        {/* Account Info */}
        <AccountInfo />

        {/* 2FA Section */}
        <TwoFactorAuth />

        {/* Session Manager */}
        <SessionManager />
        
        {/* Text Color Card */}
        <Card className="p-6 cyber-border bg-card/50 backdrop-blur-xl">
          <h2 className="text-2xl font-semibold mb-6">Text Color</h2>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="themeColor">Text Color (RGB)</Label>
              <Input 
                id="themeColor" 
                placeholder="e.g., 255, 100, 50" 
                value={themeColor} 
                onChange={(e) => setThemeColor(e.target.value)} 
                className="bg-input" 
              />
              <p className="text-sm text-muted-foreground">Only changes text colors. Glow effects stay white.</p>
            </div>
            
            <div className="p-4 rounded-lg border border-border bg-input/30">
              <p className="text-sm mb-2 text-muted-foreground">Preview:</p>
              <div 
                className="p-4 rounded-md bg-background border border-border" 
                style={{ 
                  color: `rgb(${themeColor})`,
                  textShadow: neonEnabled ? `0 0 5px rgb(${themeColor}), 0 0 10px rgb(${themeColor}), 0 0 20px rgba(${themeColor}, 0.6), 0 0 40px rgba(${themeColor}, 0.4), 0 0 80px rgba(${themeColor}, 0.2)` : 'none',
                  fontWeight: ultLuaStyle ? 'bold' : 'normal',
                  fontStyle: ultLuaStyle ? 'italic' : 'normal'
                }}
              >
                <p className="text-lg font-bold">Sample Text Preview</p>
                <p className="text-sm">This is how your text will look.</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Text Style Card */}
        <Card className="p-6 cyber-border bg-card/50 backdrop-blur-xl">
          <h2 className="text-2xl font-semibold mb-6">Text Style</h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-input/30">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-foreground" />
                <div>
                  <Label htmlFor="neon" className="text-base font-medium">Neon Effect</Label>
                  <p className="text-sm text-muted-foreground">Add a glowing neon effect to text</p>
                </div>
              </div>
              <Switch
                id="neon"
                checked={neonEnabled}
                onCheckedChange={setNeonEnabled}
              />
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-input/30">
              <div className="flex items-center gap-3">
                <Type className="w-6 h-6 text-foreground" />
                <div>
                  <Label htmlFor="ultLua" className="text-base font-medium">ULT LUA Style</Label>
                  <p className="text-sm text-muted-foreground">Bold italic text like the ULT LUA logo</p>
                </div>
              </div>
              <Switch
                id="ultLua"
                checked={ultLuaStyle}
                onCheckedChange={setUltLuaStyle}
              />
            </div>
            
            <div className="flex gap-3">
              <Button onClick={handleSaveTheme} disabled={loading} className="flex-1 cyber-glow" size="lg">
                <Save className="mr-2" size={20} />{loading ? "Saving..." : "Save Changes"}
              </Button>
              <Button onClick={handleReset} variant="outline" size="lg">
                <RotateCcw className="mr-2" size={20} />Reset
              </Button>
            </div>
          </div>
        </Card>
        
        {/* Color Presets Card */}
        <Card className="p-6 bg-card/30 border-border/50">
          <h3 className="text-lg font-semibold mb-4">Color Presets</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {colorPresets.map((preset) => (
              <Button 
                key={preset.name} 
                variant="outline" 
                onClick={() => setThemeColor(preset.color)} 
                className="justify-start h-auto py-2 px-3"
              >
                <div className={`w-4 h-4 rounded-full ${preset.bg} mr-2 flex-shrink-0`} />
                <span className="text-xs truncate">{preset.name}</span>
              </Button>
            ))}
          </div>
        </Card>
        
        <p className="text-sm text-muted-foreground text-center">
          Note: Theme settings are reset when you log out and restored when you log back in.
        </p>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
