import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Radio, Clock, User, Globe, Shield } from "lucide-react";

interface Paste {
  id: string;
  title: string | null;
  slug: string;
}

interface AccessLog {
  id: string;
  paste_id: string;
  ip_address: string;
  roblox_user_id: string | null;
  user_agent: string | null;
  access_type: string;
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
}

const AccessMonitor = () => {
  const [pastes, setPastes] = useState<Paste[]>([]);
  const [selectedPasteId, setSelectedPasteId] = useState<string>("");
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);

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
              setAccessLogs(prev => [payload.new as AccessLog, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              setAccessLogs(prev => 
                prev.map(log => log.id === (payload.new as AccessLog).id ? payload.new as AccessLog : log)
              );
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
      .select('id, title, slug')
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
      setAccessLogs(data);
    }
    setLoading(false);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const isActiveNow = (lastSeen: string) => {
    const date = new Date(lastSeen);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return diff < 60000; // Active if seen in last minute
  };

  const isBrowserRequest = (userAgent: string | null) => {
    if (!userAgent) return false;
    const ua = userAgent.toLowerCase();
    return !ua.includes('roblox') && !ua.includes('httpservice');
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

        {/* Access Logs */}
        {selectedPasteId && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary animate-pulse" />
                Live Access Feed
              </h4>
              <Badge variant="outline" className="text-xs">
                {accessLogs.length} records
              </Badge>
            </div>

            <ScrollArea className="h-[400px] rounded-lg border border-border/30 bg-background/30">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading access logs...
                </div>
              ) : accessLogs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No access logs yet</p>
                  <p className="text-xs mt-1">Logs will appear when someone accesses this paste</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {accessLogs.map((log) => {
                    const active = isActiveNow(log.last_seen_at);
                    const fromBrowser = isBrowserRequest(log.user_agent);
                    
                    return (
                      <div
                        key={log.id}
                        className={`p-3 rounded-lg border transition-all ${
                          active 
                            ? 'border-primary/50 bg-primary/10 shadow-lg shadow-primary/20' 
                            : 'border-border/30 bg-background/50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {/* Status indicator */}
                            <div className="relative">
                              <div className={`h-3 w-3 rounded-full ${
                                fromBrowser ? 'bg-destructive' : 'bg-green-500'
                              }`} />
                              {active && (
                                <div className={`absolute inset-0 h-3 w-3 rounded-full animate-ping ${
                                  fromBrowser ? 'bg-destructive' : 'bg-green-500'
                                }`} />
                              )}
                            </div>
                            
                            <div className="space-y-1">
                              {/* IP Address */}
                              <div className="flex items-center gap-2">
                                <Globe className="h-3 w-3 text-muted-foreground" />
                                <span className="font-mono text-sm font-medium">
                                  {log.ip_address}
                                </span>
                                {fromBrowser && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                    BROWSER
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Roblox User ID */}
                              {log.roblox_user_id && (
                                <div className="flex items-center gap-2">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">
                                    Roblox ID: {log.roblox_user_id}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Timestamp */}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatTime(log.last_seen_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/30">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span>Roblox Executor</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-destructive" />
                <span>Browser Access</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span>Active Now</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AccessMonitor;
