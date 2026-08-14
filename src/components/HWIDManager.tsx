import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Fingerprint, Trash2, RefreshCw, Ban, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface HWIDDevice {
  id: string;
  paste_id: string;
  roblox_user_id: string;
  hwid: string;
  created_at: string;
  updated_at: string;
  is_blocked?: boolean;
  ban_reason?: string | null;
}

interface HWIDManagerProps {
  pasteId: string;
}

const HWIDManager = ({ pasteId }: HWIDManagerProps) => {
  const [locks, setLocks] = useState<HWIDDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchLocks = useCallback(async () => {
    if (!pasteId) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('hwid-bans', {
        body: { action: 'list' },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (error) throw error;
      setLocks(((data?.devices || []) as HWIDDevice[]).filter((d) => d.paste_id === pasteId));
    } catch {
      // Fallback to direct read if the function is unavailable
      const { data } = await supabase
        .from('paste_hwid_locks')
        .select('*')
        .eq('paste_id', pasteId)
        .order('created_at', { ascending: false });
      setLocks((data || []) as HWIDDevice[]);
    }
    setLoading(false);
  }, [pasteId]);

  useEffect(() => {
    fetchLocks();
  }, [fetchLocks]);

  const resetHWID = async (lockId: string, robloxUserId: string) => {
    try {
      const { error } = await supabase
        .from('paste_hwid_locks')
        .delete()
        .eq('id', lockId);

      if (error) throw error;

      toast({
        title: "HWID Reset",
        description: `HWID lock removed for user ${robloxUserId}. They'll be re-locked on next execution.`,
      });
      fetchLocks();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleBlock = async (device: HWIDDevice) => {
    setBusy(device.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('hwid-bans', {
        body: {
          action: device.is_blocked ? 'unblock' : 'block',
          hwid: device.hwid,
          reason: `Device blocked from script settings`,
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: device.is_blocked ? "Device unblocked" : "Device blocked",
        description: device.is_blocked
          ? "This machine can execute your scripts again."
          : `Machine blocked everywhere${data?.alts_banned ? ` — ${data.alts_banned} linked account(s) banned` : ''}. Alts on this device cannot execute.`,
      });
      fetchLocks();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Fingerprint className="h-5 w-5" />
          HWID Locks & Device Blocking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
          Each user's hardware fingerprint is locked on first execution. Reset a lock to allow re-binding,
          or block the device to ban the whole machine — every alt account on that hardware is banned too.
        </p>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={fetchLocks} className="text-xs">
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : locks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No HWID locks yet. Users will be locked on their first execution.
          </p>
        ) : (
          <div className="space-y-2">
            {locks.map((lock) => (
              <div
                key={lock.id}
                className="p-3 rounded-lg border border-border/30 bg-background/30 flex items-center justify-between gap-2 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{lock.roblox_user_id}</span>
                    {lock.is_blocked && (
                      <Badge variant="destructive" className="text-[9px] px-1 py-0">Device blocked</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">
                      HWID: {lock.hwid.substring(0, 16)}...
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Locked: {new Date(lock.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy === lock.id}
                    onClick={() => toggleBlock(lock)}
                    className={lock.is_blocked
                      ? "border-primary/50 hover:bg-primary/10"
                      : "text-destructive border-destructive/50 hover:bg-destructive/10"}
                  >
                    {lock.is_blocked ? (
                      <><ShieldCheck className="h-3 w-3 mr-1" />Unblock</>
                    ) : (
                      <><Ban className="h-3 w-3 mr-1" />Block device</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resetHWID(lock.id, lock.roblox_user_id)}
                    className="text-destructive border-destructive/50 hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HWIDManager;
