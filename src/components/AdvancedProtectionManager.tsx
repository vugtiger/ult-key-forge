import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Cpu, Webhook, Plus, Trash2, GitBranch, Terminal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PasteRow {
  id: string;
  title: string | null;
  slug: string;
  executor_blacklist_enabled: boolean | null;
  vm_detection_enabled: boolean | null;
  hook_detection_enabled: boolean | null;
  dev_console_loader: boolean | null;
  force_latest_version: boolean | null;
  current_version: string | null;
  hwid_reset_cooldown_hours: number | null;
  webhook_events: string[] | null;
  webhook_alerts_enabled: boolean | null;
}

const EVENT_OPTIONS = [
  { key: "exec", label: "Executions" },
  { key: "redeem", label: "Key/HWID events" },
  { key: "ban", label: "Bans & blocks" },
  { key: "bypass", label: "Bypass attempts" },
];

const KNOWN_EXECUTORS = ["Synapse", "Krnl", "Fluxus", "Solara", "Xeno", "Hydrogen", "Codex", "Delta", "Arceus", "Evon", "Electron"];

const AdvancedProtectionManager = () => {
  const { toast } = useToast();
  const [pastes, setPastes] = useState<PasteRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [paste, setPaste] = useState<PasteRow | null>(null);
  const [blacklist, setBlacklist] = useState<{ id: string; executor_name: string }[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [newExecutor, setNewExecutor] = useState("");
  const [newVersion, setNewVersion] = useState("");
  const [newVersionNotes, setNewVersionNotes] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("pastes")
        .select("id,title,slug,executor_blacklist_enabled,vm_detection_enabled,hook_detection_enabled,dev_console_loader,force_latest_version,current_version,hwid_reset_cooldown_hours,webhook_events,webhook_alerts_enabled")
        .order("created_at", { ascending: false });
      if (data) {
        setPastes(data as any);
        if (data.length > 0 && !selectedId) setSelectedId(data[0].id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const p = pastes.find(p => p.id === selectedId);
    setPaste(p || null);
    (async () => {
      const [{ data: bl }, { data: vs }] = await Promise.all([
        supabase.from("paste_executor_blacklist").select("id,executor_name").eq("paste_id", selectedId),
        supabase.from("paste_versions").select("*").eq("paste_id", selectedId).order("created_at", { ascending: false }),
      ]);
      setBlacklist(bl || []);
      setVersions(vs || []);
    })();
  }, [selectedId, pastes]);

  const updatePaste = async (patch: Partial<PasteRow>) => {
    if (!paste) return;
    const { error } = await supabase.from("pastes").update(patch).eq("id", paste.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setPaste({ ...paste, ...patch });
    setPastes(pastes.map(p => p.id === paste.id ? { ...p, ...patch } : p));
    toast({ title: "Saved" });
  };

  const addExecutor = async (name: string) => {
    if (!paste || !name.trim()) return;
    const { data, error } = await supabase
      .from("paste_executor_blacklist")
      .insert({ paste_id: paste.id, executor_name: name.trim() })
      .select()
      .single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setBlacklist([...blacklist, data]);
    setNewExecutor("");
  };

  const removeExecutor = async (id: string) => {
    await supabase.from("paste_executor_blacklist").delete().eq("id", id);
    setBlacklist(blacklist.filter(b => b.id !== id));
  };

  const addVersion = async () => {
    if (!paste || !newVersion.trim()) return;
    const { data: pasteData } = await supabase.from("pastes").select("content").eq("id", paste.id).single();
    if (!pasteData) return;
    // Mark all old versions as not current
    await supabase.from("paste_versions").update({ is_current: false }).eq("paste_id", paste.id);
    const { data, error } = await supabase
      .from("paste_versions")
      .insert({
        paste_id: paste.id,
        version: newVersion.trim(),
        content: pasteData.content,
        notes: newVersionNotes.trim() || null,
        is_current: true,
      })
      .select()
      .single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await supabase.from("pastes").update({ current_version: newVersion.trim() }).eq("id", paste.id);
    setVersions([data, ...versions.map(v => ({ ...v, is_current: false }))]);
    setPaste({ ...paste, current_version: newVersion.trim() });
    setNewVersion(""); setNewVersionNotes("");
    toast({ title: "Version saved" });
  };

  const setCurrentVersion = async (v: any) => {
    if (!paste) return;
    await supabase.from("paste_versions").update({ is_current: false }).eq("paste_id", paste.id);
    await supabase.from("paste_versions").update({ is_current: true }).eq("id", v.id);
    await supabase.from("pastes").update({ current_version: v.version, content: v.content }).eq("id", paste.id);
    setVersions(versions.map(x => ({ ...x, is_current: x.id === v.id })));
    setPaste({ ...paste, current_version: v.version });
    toast({ title: `Switched to ${v.version}` });
  };

  const toggleEvent = (key: string) => {
    if (!paste) return;
    const current = paste.webhook_events || ["redeem","exec","ban","bypass"];
    const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
    updatePaste({ webhook_events: next });
  };

  if (pastes.length === 0) {
    return <p className="text-sm text-muted-foreground">Create a paste first to configure advanced protection.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Script</Label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full mt-1 bg-background/50 border border-border/50 rounded-lg p-2 text-sm"
        >
          {pastes.map(p => (
            <option key={p.id} value={p.id}>{p.title || p.slug}</option>
          ))}
        </select>
      </div>

      {paste && (
        <>
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Cpu className="h-5 w-5" /> Detection Layer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow
                label="VM / Emulator detection"
                description="Detect lua-vm-style emulators by checking for non-Roblox globals"
                checked={!!paste.vm_detection_enabled}
                onChange={(v) => updatePaste({ vm_detection_enabled: v })}
              />
              <ToggleRow
                label="Deep hook detection"
                description="Detect hooked HttpGet, loadstring, getfenv (catches Synapse-style hooks)"
                checked={!!paste.hook_detection_enabled}
                onChange={(v) => updatePaste({ hook_detection_enabled: v })}
              />
              <ToggleRow
                label="Use real DevConsole loader"
                description="Animated loading bar via warn() (visible in F9 dev console)"
                checked={paste.dev_console_loader !== false}
                onChange={(v) => updatePaste({ dev_console_loader: v })}
              />
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" /> Executor Blacklist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow
                label="Enable executor blacklist"
                description="Block specific executors by name (matched against User-Agent)"
                checked={!!paste.executor_blacklist_enabled}
                onChange={(v) => updatePaste({ executor_blacklist_enabled: v })}
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Executor name (e.g. Synapse, Krnl)"
                  value={newExecutor}
                  onChange={(e) => setNewExecutor(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addExecutor(newExecutor)}
                />
                <Button size="sm" onClick={() => addExecutor(newExecutor)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {KNOWN_EXECUTORS.filter(e => !blacklist.find(b => b.executor_name.toLowerCase() === e.toLowerCase())).map(e => (
                  <Button key={e} size="sm" variant="outline" className="h-6 text-xs" onClick={() => addExecutor(e)}>
                    + {e}
                  </Button>
                ))}
              </div>
              <div className="space-y-1.5">
                {blacklist.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No executors blacklisted</p>
                ) : (
                  blacklist.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-2 rounded-md border border-border/30 bg-background/30">
                      <span className="text-sm font-mono">{b.executor_name}</span>
                      <Button size="sm" variant="ghost" onClick={() => removeExecutor(b.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GitBranch className="h-5 w-5" /> Script Versions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow
                label="Force latest version"
                description="Kick users running outdated script versions"
                checked={!!paste.force_latest_version}
                onChange={(v) => updatePaste({ force_latest_version: v })}
              />
              <p className="text-xs text-muted-foreground">
                Current: <span className="font-mono text-foreground">{paste.current_version || "none"}</span>
              </p>
              <div className="flex gap-2">
                <Input placeholder="v1.0.0" value={newVersion} onChange={(e) => setNewVersion(e.target.value)} className="flex-1" />
                <Input placeholder="Release notes (optional)" value={newVersionNotes} onChange={(e) => setNewVersionNotes(e.target.value)} className="flex-1" />
                <Button size="sm" onClick={addVersion}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {versions.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-2 rounded-md border border-border/30 bg-background/30">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">{v.version}</span>
                        {v.is_current && <Badge variant="default" className="text-[10px]">current</Badge>}
                      </div>
                      {v.notes && <p className="text-xs text-muted-foreground mt-0.5">{v.notes}</p>}
                    </div>
                    {!v.is_current && (
                      <Button size="sm" variant="outline" onClick={() => setCurrentVersion(v)}>Use</Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Webhook className="h-5 w-5" /> Webhook Events
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {paste.webhook_alerts_enabled
                  ? "Discord webhook alerts are enabled. Choose which events to receive."
                  : "Enable webhook alerts in Script Settings first."}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {EVENT_OPTIONS.map(opt => {
                  const enabled = (paste.webhook_events || ["redeem","exec","ban","bypass"]).includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      onClick={() => toggleEvent(opt.key)}
                      className={`p-2.5 rounded-lg border text-left text-sm transition-all ${
                        enabled
                          ? "border-primary/50 bg-primary/10 text-foreground"
                          : "border-border/30 bg-background/30 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{opt.label}</span>
                        <Switch checked={enabled} className="pointer-events-none" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Terminal className="h-5 w-5" /> HWID Reset Cooldown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label>Cooldown hours between user-initiated HWID resets</Label>
              <Input
                type="number"
                min={0}
                max={168}
                value={paste.hwid_reset_cooldown_hours ?? 24}
                onChange={(e) => updatePaste({ hwid_reset_cooldown_hours: parseInt(e.target.value || "0") })}
              />
              <p className="text-xs text-muted-foreground">Set to 0 to allow unlimited resets. Admin overrides this.</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

const ToggleRow = ({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 bg-background/30">
    <div className="flex-1 min-w-0 pr-3">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

export default AdvancedProtectionManager;
