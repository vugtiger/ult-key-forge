import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Fingerprint, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface HWIDLock {
  id: string;
  paste_id: string;
  roblox_user_id: string;
  hwid: string;
  created_at: string;
  updated_at: string;
}

interface HWIDManagerProps {
  pasteId: string;
}

const HWIDManager = ({ pasteId }: HWIDManagerProps) => {
  const [locks, setLocks] = useState<HWIDLock[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchLocks = useCallback(async () => {
    if (!pasteId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('paste_hwid_locks')
      .select('*')
      .eq('paste_id', pasteId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLocks(data as HWIDLock[]);
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

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Fingerprint className="h-5 w-5" />
          HWID Locks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
          When HWID protection is enabled, each user's hardware fingerprint is locked on first execution.
          Only that specific device can run the script. Reset a lock to allow re-binding.
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
                className="p-3 rounded-lg border border-border/30 bg-background/30 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{lock.roblox_user_id}</span>
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HWIDManager;
