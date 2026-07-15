import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LayoutGrid, Save, RotateCcw, Sparkles } from "lucide-react";

export type LayoutPreset = "default" | "compact" | "spacious" | "cards" | "list";
export type TabShape = "pill" | "square" | "underline";
export type TabDensity = "tight" | "normal" | "loose";

export const applyDashboardLayout = (preset: LayoutPreset, radius: number, density: TabDensity, shape: TabShape) => {
  const root = document.documentElement;
  root.dataset.layoutPreset = preset;
  root.dataset.tabShape = shape;
  root.dataset.tabDensity = density;
  root.style.setProperty("--tab-radius", `${radius}px`);
  const densityMap: Record<TabDensity, string> = { tight: "0.35rem", normal: "0.625rem", loose: "0.95rem" };
  root.style.setProperty("--tab-padding-y", densityMap[density]);
  const presetMap: Record<LayoutPreset, string> = {
    default: "1.5rem", compact: "0.75rem", spacious: "2.5rem", cards: "1.75rem", list: "1rem",
  };
  root.style.setProperty("--dashboard-gap", presetMap[preset]);
};

const presets: { id: LayoutPreset; name: string; desc: string }[] = [
  { id: "default", name: "Default", desc: "Balanced spacing, standard cards" },
  { id: "compact", name: "Compact", desc: "Tight spacing, info-dense" },
  { id: "spacious", name: "Spacious", desc: "Roomy, calm, breathing space" },
  { id: "cards", name: "Cards", desc: "Card-heavy with depth" },
  { id: "list", name: "List", desc: "Minimal, list-first layout" },
];

const shapes: { id: TabShape; name: string }[] = [
  { id: "pill", name: "Pill" }, { id: "square", name: "Square" }, { id: "underline", name: "Underline" },
];

const densities: { id: TabDensity; name: string }[] = [
  { id: "tight", name: "Tight" }, { id: "normal", name: "Normal" }, { id: "loose", name: "Loose" },
];

const DashboardCustomizer = () => {
  const { toast } = useToast();
  const [preset, setPreset] = useState<LayoutPreset>("default");
  const [radius, setRadius] = useState(12);
  const [density, setDensity] = useState<TabDensity>("normal");
  const [shape, setShape] = useState<TabShape>("pill");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user_themes")
        .select("layout_preset, tab_radius, tab_density, tab_shape").eq("user_id", user.id).single();
      if (data) {
        setPreset((data.layout_preset as LayoutPreset) || "default");
        setRadius(data.tab_radius ?? 12);
        setDensity((data.tab_density as TabDensity) || "normal");
        setShape((data.tab_shape as TabShape) || "pill");
      }
    })();
  }, []);

  // Live preview
  useEffect(() => { applyDashboardLayout(preset, radius, density, shape); }, [preset, radius, density, shape]);

  const save = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("user_themes").update({
        layout_preset: preset, tab_radius: radius, tab_density: density, tab_shape: shape,
      }).eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Saved", description: "Dashboard layout updated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const reset = () => { setPreset("default"); setRadius(12); setDensity("normal"); setShape("pill"); };

  return (
    <div className="rounded-xl border border-primary/10 bg-card/20 p-5 backdrop-blur-xl space-y-5 no-neon">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <LayoutGrid className="w-4 h-4 text-primary" /> Dashboard Layout
        <span className="ml-2 text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-foreground/10 text-foreground/70">New</span>
      </h2>

      {/* Presets */}
      <div className="space-y-2">
        <Label className="text-xs">Preset</Label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {presets.map(p => (
            <button key={p.id} onClick={() => setPreset(p.id)}
              className={`text-left p-3 rounded-lg border transition-all ${
                preset === p.id ? "border-foreground/40 bg-foreground/[0.08]" : "border-border/30 bg-background/30 hover:bg-foreground/[0.04]"
              }`}>
              <p className="text-xs font-semibold">{p.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Tab shape */}
      <div className="space-y-2">
        <Label className="text-xs">Tab Shape</Label>
        <div className="grid grid-cols-3 gap-2">
          {shapes.map(s => (
            <button key={s.id} onClick={() => setShape(s.id)}
              className={`p-2.5 text-xs border transition-all ${
                shape === s.id ? "border-foreground/40 bg-foreground/[0.08]" : "border-border/30 bg-background/30 hover:bg-foreground/[0.04]"
              } ${s.id === "pill" ? "rounded-full" : s.id === "square" ? "rounded-none" : "rounded-none border-x-0 border-t-0 border-b-2"}`}>
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Density */}
      <div className="space-y-2">
        <Label className="text-xs">Density</Label>
        <div className="grid grid-cols-3 gap-2">
          {densities.map(d => (
            <button key={d.id} onClick={() => setDensity(d.id)}
              className={`p-2.5 text-xs rounded-lg border transition-all ${
                density === d.id ? "border-foreground/40 bg-foreground/[0.08]" : "border-border/30 bg-background/30 hover:bg-foreground/[0.04]"
              }`}>
              {d.name}
            </button>
          ))}
        </div>
      </div>

      {/* Radius slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Corner Radius</Label>
          <span className="text-[10px] text-muted-foreground font-mono">{radius}px</span>
        </div>
        <Slider value={[radius]} min={0} max={28} step={1} onValueChange={(v) => setRadius(v[0])} />
      </div>

      {/* Live preview */}
      <div className="rounded-lg border border-border/30 bg-background/30 p-3">
        <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1"><Sparkles size={10} /> Live Preview</p>
        <div className="flex flex-wrap gap-2">
          {["Dashboard", "Scripts", "Settings"].map((t) => (
            <div key={t} className="text-xs px-3 bg-foreground/10 text-foreground"
              style={{
                borderRadius: shape === "pill" ? 9999 : shape === "square" ? 0 : 0,
                paddingTop: density === "tight" ? "0.35rem" : density === "loose" ? "0.95rem" : "0.625rem",
                paddingBottom: density === "tight" ? "0.35rem" : density === "loose" ? "0.95rem" : "0.625rem",
                ...(shape === "underline" ? { borderBottom: "2px solid hsl(var(--foreground))", background: "transparent", paddingLeft: 0, paddingRight: 0, marginRight: 12 } : {}),
                ...(shape !== "underline" ? { borderRadius: shape === "pill" ? 9999 : `${radius}px` } : {}),
              }}>
              {t}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={save} disabled={loading} className="flex-1 h-9 text-xs rounded-lg" size="sm">
          <Save className="mr-1.5" size={14} />{loading ? "Saving..." : "Save Layout"}
        </Button>
        <Button onClick={reset} variant="outline" size="sm" className="h-9 text-xs rounded-lg border-primary/10">
          <RotateCcw className="mr-1.5" size={14} />Reset
        </Button>
      </div>
    </div>
  );
};

export default DashboardCustomizer;
