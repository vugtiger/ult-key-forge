import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Infinity, Trash2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AccessEntry {
  id: string;
  paste_id: string;
  roblox_user_id: string;
  access_type: 'whitelist' | 'blacklist';
  expires_at: string | null;
  is_eternal: boolean;
  created_at: string;
}

interface WhitelistTimeManagerProps {
  pasteId: string;
  onUpdate: () => void;
}

const WhitelistTimeManager = ({ pasteId, onUpdate }: WhitelistTimeManagerProps) => {
  const storageKey = pasteId ? `whitelist-time-enabled:${pasteId}` : "whitelist-time-enabled";
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (!pasteId) return false;
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });
  const [entries, setEntries] = useState<AccessEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Persist "Enable Time Management" per paste so it doesn't flip off on re-mounts.
  useEffect(() => {
    if (!pasteId) return;
    try {
      setEnabled(localStorage.getItem(storageKey) === "1");
    } catch {
      // ignore
    }
  }, [pasteId, storageKey]);

  useEffect(() => {
    if (!pasteId) return;
    try {
      localStorage.setItem(storageKey, enabled ? "1" : "0");
    } catch {
      // ignore
    }
  }, [pasteId, enabled, storageKey]);

  const fetchEntries = useCallback(async () => {
    if (!pasteId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('paste_access_control')
      .select('*')
      .eq('paste_id', pasteId)
      .eq('access_type', 'whitelist')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setEntries(data as AccessEntry[]);
    }
    setLoading(false);
  }, [pasteId]);

  useEffect(() => {
    if (pasteId) {
      fetchEntries();
    }
  }, [pasteId, fetchEntries]);

  // Auto-check for expired entries every 10 seconds when enabled
  useEffect(() => {
    if (!pasteId || !enabled) return;
    
    const checkAndRemoveExpired = async () => {
      const now = new Date().toISOString();
      
      // Delete expired entries from database
      const { error } = await supabase
        .from('paste_access_control')
        .delete()
        .eq('paste_id', pasteId)
        .eq('access_type', 'whitelist')
        .eq('is_eternal', false)
        .not('expires_at', 'is', null)
        .lt('expires_at', now);
      
      if (!error) {
        fetchEntries();
        onUpdate();
      }
    };

    checkAndRemoveExpired();
    const interval = setInterval(checkAndRemoveExpired, 10000);
    
    return () => clearInterval(interval);
  }, [pasteId, enabled, fetchEntries, onUpdate]);

  const setExpiration = async (entryId: string, expiresAt: string | null, isEternal: boolean) => {
    try {
      const { error } = await supabase
        .from('paste_access_control')
        .update({ 
          expires_at: expiresAt,
          is_eternal: isEternal
        })
        .eq('id', entryId);

      if (error) throw error;

      toast({ 
        title: "Updated!", 
        description: isEternal ? "Set to eternal" : expiresAt ? "Expiration set" : "Expiration removed" 
      });
      fetchEntries();
      onUpdate();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDateTimeChange = (entryId: string, value: string) => {
    if (value) {
      setExpiration(entryId, new Date(value).toISOString(), false);
    }
  };

  const setEternal = (entryId: string) => {
    setExpiration(entryId, null, true);
  };

  const removeExpiration = (entryId: string) => {
    setExpiration(entryId, null, false);
  };

  const formatExpiration = (entry: AccessEntry) => {
    if (entry.is_eternal) return "Eternal";
    if (!entry.expires_at) return "No expiration";
    const date = new Date(entry.expires_at);
    const now = new Date();
    if (date < now) return "Expired";
    return date.toLocaleString();
  };

  const isExpired = (entry: AccessEntry) => {
    if (entry.is_eternal) return false;
    if (!entry.expires_at) return false;
    return new Date(entry.expires_at) < new Date();
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Set Whitelisted User ID Time
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-background/30 border border-border/30">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Enable Time Management</span>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => {
              setEnabled(checked);
              if (!pasteId) return;
              try {
                localStorage.setItem(storageKey, checked ? "1" : "0");
              } catch {
                // ignore
              }
            }}
          />
        </div>

        {enabled && (
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No whitelisted users yet</p>
            ) : (
              entries.map((entry) => (
                <div 
                  key={entry.id} 
                  className={`p-3 rounded-lg border ${isExpired(entry) ? 'border-red-500/50 bg-red-500/10' : 'border-border/30 bg-background/30'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm">{entry.roblox_user_id}</span>
                    <span className={`text-xs ${isExpired(entry) ? 'text-red-400' : entry.is_eternal ? 'text-green-400' : 'text-muted-foreground'}`}>
                      {formatExpiration(entry)}
                    </span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Input
                      type="datetime-local"
                      className="flex-1 min-w-[200px] text-xs bg-background/50"
                      onChange={(e) => handleDateTimeChange(entry.id, e.target.value)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEternal(entry.id)}
                      className={entry.is_eternal ? 'bg-green-500/20 border-green-500/50' : ''}
                    >
                      <Infinity className="h-4 w-4 mr-1" />
                      Eternal
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeExpiration(entry.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WhitelistTimeManager;
