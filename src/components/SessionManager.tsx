import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Monitor, Smartphone, LogOut, Crown, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Session {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  last_active: string;
  created_at: string;
  session_token: string;
}

const SessionManager = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [currentIp, setCurrentIp] = useState<string | null>(null);
  const [primaryIp, setPrimaryIp] = useState<string | null>(null);
  const [currentSessionToken, setCurrentSessionToken] = useState<string | null>(null);
  const [kickDialog, setKickDialog] = useState<{ open: boolean; session: Session | null }>({ open: false, session: null });
  const [kicking, setKicking] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get the current session from Supabase auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Use session access token as unique identifier for this session
    const sessionToken = session.access_token.slice(-32); // Last 32 chars as identifier
    setCurrentSessionToken(sessionToken);

    // Fetch primary IP (owner's original registration IP)
    const { data: primaryIpData } = await supabase
      .from('user_ips')
      .select('ip_address')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single();

    if (primaryIpData) {
      setPrimaryIp(primaryIpData.ip_address);
    }

    // Get current user's IP from their most recent login
    const { data: currentIpData } = await supabase
      .from('user_ips')
      .select('ip_address')
      .eq('user_id', user.id)
      .order('last_used_at', { ascending: false })
      .limit(1)
      .single();

    if (currentIpData) {
      setCurrentIp(currentIpData.ip_address);
      // Check if current user is the owner
      if (primaryIpData && currentIpData.ip_address === primaryIpData.ip_address) {
        setIsOwner(true);
      }
    }

    // Create/update this session in user_sessions
    await createOrUpdateSession(user.id, sessionToken, currentIpData?.ip_address || null);
    
    // Fetch all sessions
    await fetchSessions();
  };

  const createOrUpdateSession = async (userId: string, sessionToken: string, ipAddress: string | null) => {
    const userAgent = navigator.userAgent;
    
    // Check if session already exists
    const { data: existingSession } = await supabase
      .from('user_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('session_token', sessionToken)
      .single();

    if (existingSession) {
      // Update last_active
      await supabase
        .from('user_sessions')
        .update({ last_active: new Date().toISOString() })
        .eq('id', existingSession.id);
    } else {
      // Create new session
      await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          session_token: sessionToken,
          ip_address: ipAddress,
          user_agent: userAgent,
          last_active: new Date().toISOString()
        });
    }
  };

  const fetchSessions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('last_active', { ascending: false });

    if (!error && data) {
      setSessions(data);
    }
    setLoading(false);
  };

  const openKickDialog = (session: Session) => {
    // Check if this is the current session
    if (session.session_token === currentSessionToken) {
      // Can log out self but not block
      kickSession(session, false);
      return;
    }
    setKickDialog({ open: true, session });
  };

  const kickSession = async (session: Session, block: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setKicking(true);
    try {
      // Delete the session
      const { error: sessionError } = await supabase
        .from('user_sessions')
        .delete()
        .eq('id', session.id);

      if (sessionError) throw sessionError;

      // If blocking and has IP, add to blocked_ips
      if (block && session.ip_address) {
        const { error: blockError } = await supabase
          .from('blocked_ips')
          .insert({
            user_id: user.id,
            ip_address: session.ip_address,
            blocked_by: user.id
          });

        // Ignore unique constraint violation (already blocked)
        if (blockError && !blockError.message.includes('duplicate')) {
          throw blockError;
        }
      }

      setSessions(prev => prev.filter(s => s.id !== session.id));
      
      // If it's the current session, sign out
      if (session.session_token === currentSessionToken) {
        await supabase.auth.signOut();
        return;
      }

      toast({ 
        title: block ? "Device blocked" : "Session ended", 
        description: block 
          ? "The device has been logged out and blocked from this account" 
          : "The session has been terminated" 
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setKicking(false);
      setKickDialog({ open: false, session: null });
    }
  };

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Monitor className="h-5 w-5" />;
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <Smartphone className="h-5 w-5" />;
    }
    return <Monitor className="h-5 w-5" />;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const isCurrentSession = (session: Session) => session.session_token === currentSessionToken;
  const isOwnerDevice = (session: Session) => session.ip_address === primaryIp;

  return (
    <>
      <Card className="p-6 cyber-border bg-card/50 backdrop-blur-xl">
        <CardHeader className="px-0 pt-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Active Sessions
              {isOwner && (
                <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Crown className="h-3 w-3" /> Owner
                </span>
              )}
            </CardTitle>
          </div>
          {!isOwner && (
            <p className="text-sm text-muted-foreground mt-2">
              Only the account owner can manage sessions
            </p>
          )}
        </CardHeader>
        <CardContent className="px-0 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sessions found</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`flex items-center justify-between p-3 rounded-lg bg-background/30 border ${
                  isCurrentSession(session) ? 'border-primary/50' : 'border-border/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  {getDeviceIcon(session.user_agent)}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {session.ip_address || "Unknown IP"}
                      </p>
                      {isCurrentSession(session) && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                          This device
                        </span>
                      )}
                      {isOwnerDevice(session) && !isCurrentSession(session) && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Crown className="h-3 w-3" /> Owner
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last active: {formatTime(session.last_active)}
                    </p>
                  </div>
                </div>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openKickDialog(session)}
                    className={isCurrentSession(session) 
                      ? "text-muted-foreground hover:text-foreground" 
                      : "text-destructive hover:text-destructive"
                    }
                    title={isCurrentSession(session) ? "Log out" : "Kick and block"}
                  >
                    {isCurrentSession(session) ? (
                      <LogOut className="h-4 w-4" />
                    ) : (
                      <Ban className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog for kicking other devices */}
      <Dialog open={kickDialog.open} onOpenChange={(open) => !open && setKickDialog({ open: false, session: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              Block this device?
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to log this device out? <strong>If you do, the user will not be able to log back in</strong> to your account from this IP address.
              <br /><br />
              <span className="text-muted-foreground">
                IP: {kickDialog.session?.ip_address || "Unknown"}
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setKickDialog({ open: false, session: null })}
              disabled={kicking}
            >
              No, Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => kickDialog.session && kickSession(kickDialog.session, true)}
              disabled={kicking}
            >
              {kicking ? "Blocking..." : "Yes, Block Device"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SessionManager;