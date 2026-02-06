import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Shield, Eye, Radio } from "lucide-react";
import AccessLogRow from "@/components/access-monitor/AccessLogRow";
import type { AccessLog, PasteOption } from "@/components/access-monitor/types";
import { groupForDisplay, mergeAccessLog } from "@/components/access-monitor/utils";

const AccessMonitor = () => {
  const [pastes, setPastes] = useState<PasteOption[]>([]);
  const [selectedPasteId, setSelectedPasteId] = useState<string>("");
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPastes();
  }, []);

  useEffect(() => {
    if (selectedPasteId) {
      fetchAccessLogs(selectedPasteId);
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel(`access-logs-${selectedPasteId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'paste_access_logs',
            filter: `paste_id=eq.${selectedPasteId}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setAccessLogs((prev) => mergeAccessLog(prev, payload.new as AccessLog));
            } else if (payload.eventType === 'UPDATE') {
              setAccessLogs((prev) => mergeAccessLog(prev, payload.new as AccessLog));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedPasteId]);

  const fetchPastes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('pastes')
      .select('id, title, slug, ip_tracking_enabled')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPastes(data);
      if (data.length > 0 && !selectedPasteId) {
        setSelectedPasteId(data[0].id);
      }
    }
    setLoading(false);
  };

  const fetchAccessLogs = async (pasteId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('paste_access_logs')
      .select('*')
      .eq('paste_id', pasteId)
      .order('last_seen_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      // Cast JSONB fields properly using unknown first
      const typedData = data.map(log => ({
        ...log,
        roblox_groups: log.roblox_groups as unknown as AccessLog['roblox_groups'],
        roblox_badges: log.roblox_badges as unknown as AccessLog['roblox_badges'],
        roblox_favorites: log.roblox_favorites as unknown as AccessLog['roblox_favorites'],
      })) as AccessLog[];
      setAccessLogs(typedData);
    }
    setLoading(false);
  };

  const selectedPaste = useMemo(
    () => pastes.find((p) => p.id === selectedPasteId) || null,
    [pastes, selectedPasteId],
  );

  const displayLogs = useMemo(() => groupForDisplay(accessLogs), [accessLogs]);

  const toggleIpTracking = async (enabled: boolean) => {
    if (!selectedPasteId) return;
    const { error } = await supabase
      .from('pastes')
      .update({ ip_tracking_enabled: enabled })
      .eq('id', selectedPasteId);

    if (!error) {
      setPastes((prev) => prev.map((p) => (p.id === selectedPasteId ? { ...p, ip_tracking_enabled: enabled } : p)));
    }
  };

  const deleteLog = async (log: AccessLog) => {
    setDeletingId(log.id);
    try {
      const { error } = await supabase
        .from('paste_access_logs')
        .delete()
        .eq('id', log.id);
      if (!error) {
        setAccessLogs((prev) => prev.filter((l) => l.id !== log.id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="cyber-border bg-card/50 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Access Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Paste Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Paste to Monitor</label>
          <Select value={selectedPasteId} onValueChange={setSelectedPasteId}>
            <SelectTrigger className="bg-background/50">
              <SelectValue placeholder="Choose a paste..." />
            </SelectTrigger>
            <SelectContent>
              {pastes.map((paste) => (
                <SelectItem key={paste.id} value={paste.id}>
                  {paste.title || "Untitled"} - {paste.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* IP Tracking Toggle */}
        {selectedPaste && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-background/30 border border-border/30">
            <div className="flex items-center gap-2">
              <span className="text-sm">
                IP Tracking {selectedPaste.ip_tracking_enabled === false ? "Disabled" : "Enabled"}
              </span>
              <Badge variant="outline" className="text-[10px]">
                per-paste
              </Badge>
            </div>
            <Switch
              checked={selectedPaste.ip_tracking_enabled !== false}
              onCheckedChange={toggleIpTracking}
            />
          </div>
        )}

        {/* Access Logs */}
        {selectedPasteId && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary animate-pulse" />
                Live Access Feed
              </h4>
               <Badge variant="outline" className="text-xs">
                 {displayLogs.length} shown
               </Badge>
            </div>

            <ScrollArea className="h-[400px] rounded-lg border border-border/30 bg-background/30">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading access logs...
                </div>
               ) : displayLogs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No access logs yet</p>
                  <p className="text-xs mt-1">Logs will appear when someone accesses this paste</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                   {displayLogs.map((log) => (
                     <AccessLogRow
                       key={log.id}
                       log={log}
                       deleting={deletingId === log.id}
                       onDelete={deleteLog}
                     />
                   ))}
                </div>
              )}
            </ScrollArea>

            {/* Legend */}
             <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/30">
               <div className="flex items-center gap-1.5">
                 <div className="h-2 w-2 rounded-full bg-primary" />
                 <span>Executor (active)</span>
               </div>
               <div className="flex items-center gap-1.5">
                 <div className="h-2 w-2 rounded-full bg-destructive" />
                 <span>Browser (active)</span>
               </div>
               <div className="flex items-center gap-1.5">
                 <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                 <span>Offline</span>
               </div>
             </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AccessMonitor;
