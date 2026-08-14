import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Key, Plus, Copy, Trash2, BarChart3, ShieldCheck, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getLoadstring } from "@/lib/loader-url";
import { useToast } from "@/hooks/use-toast";

interface PasteRow {
  id: string;
  title: string | null;
  slug: string;
  protection_mode: string;
}

interface PKey {
  id: string;
  key_value: string;
  bound_roblox_user_id: string | null;
  bound_roblox_username: string | null;
  bound_at: string | null;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
}

interface PKEvent {
  event_type: string;
  roblox_user_id: string | null;
  created_at: string;
  ip_address: string | null;
}

const randomKey = () =>
  "ULT-" +
  Array.from({ length: 4 }, () =>
    Math.random().toString(36).slice(2, 7).toUpperCase()
  ).join("-");

const ProtectionKeyManager = () => {
  const { toast } = useToast();
  const [pastes, setPastes] = useState<PasteRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [paste, setPaste] = useState<PasteRow | null>(null);
  const [keys, setKeys] = useState<PKey[]>([]);
  const [events, setEvents] = useState<PKEvent[]>([]);
  const [newKey, setNewKey] = useState("");
  const [bulkCount, setBulkCount] = useState(5);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("pastes")
        .select("id,title,slug,protection_mode")
        .order("created_at", { ascending: false });
      if (data) {
        setPastes(data as any);
        if (data.length > 0 && !selectedId) setSelectedId(data[0].id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const p = pastes.find((p) => p.id === selectedId);
    setPaste(p || null);
    refresh();
  }, [selectedId, pastes]);

  const refresh = async () => {
    if (!selectedId) return;
    const [{ data: ks }, { data: evs }] = await Promise.all([
      (supabase.from("protection_keys" as any) as any)
        .select("*")
        .eq("paste_id", selectedId)
        .order("created_at", { ascending: false }),
      (supabase.from("protection_key_events" as any) as any)
        .select("event_type,roblox_user_id,created_at,ip_address")
        .eq("paste_id", selectedId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setKeys((ks as any) || []);
    setEvents((evs as any) || []);
  };

  const enableMode = async () => {
    if (!paste) return;
    const { error } = await supabase
      .from("pastes")
      .update({ protection_mode: "protection_key" })
      .eq("id", paste.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setPaste({ ...paste, protection_mode: "protection_key" });
    setPastes(pastes.map((p) => (p.id === paste.id ? { ...p, protection_mode: "protection_key" } : p)));
    toast({ title: "Protection Key mode enabled" });
  };

  const disableMode = async () => {
    if (!paste) return;
    if (!confirm("Disable Protection Key mode? Existing keys will stop working until you re-enable it.")) return;
    const { error } = await supabase
      .from("pastes")
      .update({ protection_mode: "whitelist" })
      .eq("id", paste.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setPaste({ ...paste, protection_mode: "whitelist" });
    setPastes(pastes.map((p) => (p.id === paste.id ? { ...p, protection_mode: "whitelist" } : p)));
    toast({ title: "Protection Key mode disabled", description: "Script reverted to whitelist mode. Keys are kept but inactive." });
  };

  const toggleKeyActive = async (k: PKey) => {
    const { error } = await (supabase.from("protection_keys" as any) as any)
      .update({ is_active: !k.is_active })
      .eq("id", k.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setKeys(keys.map((x) => (x.id === k.id ? { ...x, is_active: !k.is_active } : x)));
    toast({ title: k.is_active ? "Key disabled" : "Key enabled" });
  };

  const addKey = async (val: string) => {
    if (!paste || !val.trim()) return;
    const { data, error } = await (supabase.from("protection_keys" as any) as any)
      .insert({ paste_id: paste.id, key_value: val.trim() })
      .select()
      .single();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setKeys([data as PKey, ...keys]);
    setNewKey("");
  };

  const generateBulk = async () => {
    if (!paste) return;
    const rows = Array.from({ length: bulkCount }, () => ({
      paste_id: paste.id,
      key_value: randomKey(),
    }));
    const { data, error } = await (supabase.from("protection_keys" as any) as any)
      .insert(rows)
      .select();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setKeys([...((data as PKey[]) || []), ...keys]);
    toast({ title: `Generated ${bulkCount} keys` });
  };

  const removeKey = async (id: string) => {
    await (supabase.from("protection_keys" as any) as any).delete().eq("id", id);
    setKeys(keys.filter((k) => k.id !== id));
  };

  const copyLoader = (k: PKey) => {
    if (!paste) return;
    const snippet = getLoadstring(paste.slug, k.key_value);
    navigator.clipboard.writeText(snippet);
    toast({ title: "Loader copied" });
  };

  const copyKey = (val: string) => {
    navigator.clipboard.writeText(val);
    toast({ title: "Key copied" });
  };

  if (pastes.length === 0) {
    return <p className="text-sm text-muted-foreground">Create a paste first.</p>;
  }

  const stats = {
    total: keys.length,
    bound: keys.filter((k) => k.bound_roblox_user_id).length,
    redeems: events.filter((e) => e.event_type === "redeem").length,
    invalid: events.filter((e) => e.event_type === "kick_invalid").length,
    spoof: events.filter((e) => e.event_type === "kick_spoof").length,
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Script</Label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full mt-1 bg-background/50 border border-border/50 rounded-lg p-2 text-sm"
        >
          {pastes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title || p.slug} {p.protection_mode === "protection_key" ? "(key)" : ""}
            </option>
          ))}
        </select>
      </div>

      {paste && paste.protection_mode !== "protection_key" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Enable Protection Key mode for this script?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Users will need to set <code className="px-1 rounded bg-background/50">_G.ScriptKey</code> before loading. Keys bind to the first Roblox account that uses them.
                </p>
              </div>
            </div>
            <Button onClick={enableMode} size="sm" className="w-full">Enable Protection Key</Button>
          </CardContent>
        </Card>
      )}

      {paste && paste.protection_mode === "protection_key" && (
        <>
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Key Analytics
              </CardTitle>
              <Button size="sm" variant="outline" onClick={disableMode} className="text-xs h-7 border-destructive/40 text-destructive hover:bg-destructive/10">
                <ShieldOff className="h-3 w-3 mr-1" /> Disable Key Mode
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { label: "Total", value: stats.total },
                  { label: "Bound", value: stats.bound },
                  { label: "Redeems", value: stats.redeems },
                  { label: "Invalid", value: stats.invalid },
                  { label: "Spoof", value: stats.spoof },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-border/30 bg-background/30 p-2 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                    <p className="text-xl font-bold">{s.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4" /> Generate Keys
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Custom key value" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
                <Button size="sm" onClick={() => addKey(newKey)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={bulkCount}
                  onChange={(e) => setBulkCount(parseInt(e.target.value) || 1)}
                  className="w-20"
                />
                <Button size="sm" variant="outline" onClick={generateBulk} className="flex-1">
                  Generate {bulkCount} random keys
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">Keys ({keys.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {keys.length === 0 ? (
                <p className="text-xs text-muted-foreground">No keys yet.</p>
              ) : (
                keys.map((k) => (
                  <div key={k.id} className={`flex items-center justify-between p-2 rounded-md border gap-2 ${k.is_active ? 'border-border/30 bg-background/30' : 'border-destructive/20 bg-destructive/5 opacity-70'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono truncate">{k.key_value}</span>
                        {!k.is_active && <Badge variant="destructive" className="text-[10px]">disabled</Badge>}
                        {k.bound_roblox_user_id ? (
                          <Badge variant="default" className="text-[10px]">bound: {k.bound_roblox_user_id}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">unbound</Badge>
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => toggleKeyActive(k)} title={k.is_active ? "Disable key" : "Enable key"}>
                      {k.is_active ? <ShieldOff className="h-3 w-3 text-muted-foreground" /> : <ShieldCheck className="h-3 w-3 text-primary" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => copyKey(k.key_value)} title="Copy key">
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => copyLoader(k)} title="Copy loader snippet">
                      <Key className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeKey(k.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">Recent Events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 max-h-60 overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground">No events yet.</p>
              ) : (
                events.map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded border border-border/20 bg-background/20">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          e.event_type === "success" || e.event_type === "redeem"
                            ? "default"
                            : "destructive"
                        }
                        className="text-[10px]"
                      >
                        {e.event_type}
                      </Badge>
                      <span className="font-mono text-muted-foreground">uid:{e.roblox_user_id || "?"}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ProtectionKeyManager;
