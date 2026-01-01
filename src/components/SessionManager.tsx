import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Monitor, Smartphone, LogOut, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Session {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  last_active: string;
  created_at: string;
}

const SessionManager = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSessions();
  }, []);

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

  const kickSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast({ title: "Session ended", description: "The session has been terminated" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const kickAllSessions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setSessions([]);
      toast({ title: "All sessions ended", description: "All sessions have been terminated" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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

  return (
    <Card className="p-6 cyber-border bg-card/50 backdrop-blur-xl">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Active Sessions
          </CardTitle>
          {sessions.length > 0 && (
            <Button variant="destructive" size="sm" onClick={kickAllSessions}>
              <LogOut className="h-4 w-4 mr-1" />
              End All
            </Button>
          )}
        </div>
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
              className="flex items-center justify-between p-3 rounded-lg bg-background/30 border border-border/30"
            >
              <div className="flex items-center gap-3">
                {getDeviceIcon(session.user_agent)}
                <div>
                  <p className="text-sm font-medium">
                    {session.ip_address || "Unknown IP"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last active: {formatTime(session.last_active)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => kickSession(session.id)}
                className="text-destructive hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default SessionManager;
