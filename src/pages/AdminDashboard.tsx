import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Shield, Trash2, Search, Ban, Copy, Download, Users, FileCode, Globe,
  RefreshCw, Activity, Star, Clock, Database, Eye, EyeOff, XCircle,
  AlertTriangle, ShieldAlert, ShieldCheck, Crosshair, Skull, LogOut
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// Types
interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  discord_username: string | null;
  is_banned: boolean;
  ban_reason: string | null;
  ip_addresses: { address: string; is_primary: boolean; last_used: string }[];
}
interface AdminPaste {
  id: string; title: string | null; slug: string; content: string;
  user_id: string; created_at: string; updated_at: string;
  protection_enabled: boolean; owner_email: string;
}
interface AccessLog {
  id: string; paste_id: string; paste_slug: string; paste_title: string;
  paste_owner_email: string; ip_address: string; roblox_user_id: string | null;
  roblox_username: string | null; roblox_avatar_url: string | null;
  discord_username: string | null; access_type: string; is_active: boolean;
  last_seen_at: string; created_at: string; user_agent: string | null;
}
interface UserSession {
  id: string; user_id: string; user_email: string; session_token: string;
  ip_address: string | null; user_agent: string | null; last_active: string; created_at: string;
}
interface UserActivityRecord {
  id: string; user_id: string; user_email: string;
  activity_type: string; activity_data: any; created_at: string;
}
interface Review {
  id: string; user_id: string | null; username: string;
  content: string; stars: number; is_fake: boolean; created_at: string;
}
interface GlobalBan {
  id: string; ban_type: string; ban_value: string; reason: string | null;
  banned_at: string; is_active: boolean; metadata: any;
}
interface ThreatEntry {
  id: string; threat_type: string; source_ip: string | null;
  roblox_user_id: string | null; discord_user_id: string | null;
  details: any; severity: string; resolved: boolean;
  auto_banned: boolean; created_at: string;
}

const AdminDashboard = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pastes, setPastes] = useState<AdminPaste[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [activity, setActivity] = useState<UserActivityRecord[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [globalBans, setGlobalBans] = useState<GlobalBan[]>([]);
  const [threats, setThreats] = useState<ThreatEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbLoading, setDbLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pasteSearch, setPasteSearch] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [banReason, setBanReason] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [expandedPaste, setExpandedPaste] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  // Global ban form
  const [newBanType, setNewBanType] = useState("ip");
  const [newBanValue, setNewBanValue] = useState("");
  const [newBanReason, setNewBanReason] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  // Standalone auth — no DashboardLayout, no shared hooks
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (!session) { navigate("/auth"); return; }
      
      setCurrentUserId(session.user.id);
      
      // Check admin role directly
      const { data } = await supabase.from('user_roles').select('role')
        .eq('user_id', session.user.id).eq('role', 'admin').maybeSingle();
      
      if (!mounted) return;
      if (!data) { navigate("/dashboard"); return; }
      
      setIsAdmin(true);
      setAuthReady(true);
    });

    return () => { mounted = false; };
  }, [navigate]);

  useEffect(() => {
    if (authReady && isAdmin) { fetchUsers(); fetchPastes(); fetchGlobalBans(); fetchThreats(); }
  }, [authReady, isAdmin]);

  const adminCall = async (action: string, params: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke('admin-api', { body: { action, ...params } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const fetchUsers = async () => {
    setLoading(true);
    try { const data = await adminCall('list_users'); setUsers(data.users || []); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };
  const fetchPastes = async () => {
    try { const data = await adminCall('list_pastes'); setPastes(data.pastes || []); }
    catch (e: any) { console.error(e); }
  };
  const fetchAccessLogs = async () => {
    setDbLoading(true);
    try { const data = await adminCall('list_access_logs'); setAccessLogs(data.logs || []); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setDbLoading(false); }
  };
  const fetchSessions = async () => {
    setDbLoading(true);
    try { const data = await adminCall('list_sessions'); setSessions(data.sessions || []); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setDbLoading(false); }
  };
  const fetchActivity = async () => {
    setDbLoading(true);
    try { const data = await adminCall('list_activity'); setActivity(data.activity || []); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setDbLoading(false); }
  };
  const fetchReviews = async () => {
    setDbLoading(true);
    try { const data = await adminCall('list_reviews'); setReviews(data.reviews || []); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setDbLoading(false); }
  };
  const fetchGlobalBans = async () => {
    try { const data = await adminCall('list_global_bans'); setGlobalBans(data.bans || []); }
    catch (e: any) { console.error(e); }
  };
  const fetchThreats = async () => {
    try { const data = await adminCall('list_threats'); setThreats(data.threats || []); }
    catch (e: any) { console.error(e); }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Permanently delete this user and all their data?')) return;
    try { await adminCall('delete_user', { target_user_id: userId }); toast({ title: "User Deleted" }); fetchUsers(); fetchPastes(); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };
  const handleBanUser = async (userId: string) => {
    if (!banReason.trim()) { toast({ title: "Error", description: "Provide a ban reason", variant: "destructive" }); return; }
    try { await adminCall('ban_user', { target_user_id: userId, reason: banReason }); toast({ title: "User Banned" }); setBanReason(""); setSelectedUserId(null); fetchUsers(); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };
  const handleUnbanUser = async (userId: string) => {
    try { await adminCall('unban_user', { target_user_id: userId }); toast({ title: "User Unbanned" }); fetchUsers(); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };
  const handleDeletePaste = async (pasteId: string) => {
    if (!confirm('Delete this paste permanently?')) return;
    try { await adminCall('delete_paste', { paste_id: pasteId }); toast({ title: "Paste Deleted" }); fetchPastes(); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };
  const handleDeleteReview = async (reviewId: string) => {
    try { await adminCall('delete_review', { review_id: reviewId }); setReviews(prev => prev.filter(r => r.id !== reviewId)); toast({ title: "Review Deleted" }); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };
  const handleAddGlobalBan = async () => {
    if (!newBanValue.trim()) { toast({ title: "Error", description: "Provide a value to ban", variant: "destructive" }); return; }
    try {
      await adminCall('add_global_ban', { ban_type: newBanType, ban_value: newBanValue, reason: newBanReason });
      toast({ title: "Global Ban Added", description: `${newBanType}: ${newBanValue}` });
      setNewBanValue(""); setNewBanReason(""); fetchGlobalBans();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };
  const handleRemoveGlobalBan = async (banId: string) => {
    try { await adminCall('remove_global_ban', { ban_id: banId }); toast({ title: "Ban Removed" }); fetchGlobalBans(); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };
  const handleResolveThreat = async (threatId: string) => {
    try { await adminCall('resolve_threat', { threat_id: threatId }); toast({ title: "Threat Resolved" }); fetchThreats(); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };
  const handleAutoBanThreat = async (threat: ThreatEntry) => {
    try {
      // Auto-ban the IP and any associated IDs
      if (threat.source_ip) await adminCall('add_global_ban', { ban_type: 'ip', ban_value: threat.source_ip, reason: `Auto-ban: ${threat.threat_type}` });
      if (threat.roblox_user_id) await adminCall('add_global_ban', { ban_type: 'roblox_id', ban_value: threat.roblox_user_id, reason: `Auto-ban: ${threat.threat_type}` });
      if (threat.discord_user_id) await adminCall('add_global_ban', { ban_type: 'discord_id', ban_value: threat.discord_user_id, reason: `Auto-ban: ${threat.threat_type}` });
      await adminCall('resolve_threat', { threat_id: threat.id, auto_banned: true });
      toast({ title: "Threat Auto-Banned", description: "All associated IPs/IDs have been globally banned" });
      fetchThreats(); fetchGlobalBans();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const handleCopy = (content: string) => { navigator.clipboard.writeText(content); toast({ title: "Copied" }); };
  const handleDownloadPaste = (paste: AdminPaste) => {
    const blob = new Blob([paste.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${paste.title || paste.slug}.lua`; a.click(); URL.revokeObjectURL(url);
  };

  // Filters
  const filteredUsers = users.filter(u => u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || u.discord_username?.toLowerCase().includes(searchTerm.toLowerCase()) || u.ip_addresses.some(ip => ip.address.includes(searchTerm)));
  const filteredPastes = pastes.filter(p => (p.title || '').toLowerCase().includes(pasteSearch.toLowerCase()) || p.slug.toLowerCase().includes(pasteSearch.toLowerCase()) || p.owner_email.toLowerCase().includes(pasteSearch.toLowerCase()));
  const filteredLogs = accessLogs.filter(l => l.ip_address?.includes(logSearch) || l.roblox_username?.toLowerCase().includes(logSearch.toLowerCase()) || l.paste_slug?.includes(logSearch) || l.paste_owner_email?.toLowerCase().includes(logSearch.toLowerCase()));
  const filteredSessions = sessions.filter(s => s.user_email?.toLowerCase().includes(sessionSearch.toLowerCase()) || s.ip_address?.includes(sessionSearch));
  const filteredActivity = activity.filter(a => a.user_email?.toLowerCase().includes(activitySearch.toLowerCase()) || a.activity_type?.toLowerCase().includes(activitySearch.toLowerCase()));

  // Threat stats
  const unresolvedThreats = threats.filter(t => !t.resolved);
  const criticalThreats = unresolvedThreats.filter(t => t.severity === 'critical');

  if (!authReady || !isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Standalone header */}
      <header className="h-14 border-b border-border/30 flex items-center px-6 sticky top-0 bg-background/80 backdrop-blur-xl z-10">
        <Shield className="h-5 w-5 text-primary mr-2" />
        <span className="font-bold">ULT CLOUD — Command Center</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="h-4 w-4 mr-1" />Logout</Button>
      </header>
      <main className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Command Center</h1>
            <p className="text-sm text-muted-foreground">Full site control · Threat detection · Global bans</p>
          </div>
        </div>

        {/* Alert banner for critical threats */}
        {criticalThreats.length > 0 && (
          <Card className="p-4 bg-destructive/10 border-destructive/50 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
            <div className="flex-1">
              <p className="font-semibold text-destructive">{criticalThreats.length} Critical Threat{criticalThreats.length > 1 ? 's' : ''} Detected</p>
              <p className="text-xs text-muted-foreground">Review the Threats tab immediately</p>
            </div>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-3 bg-card/50 backdrop-blur-xl border-border/30">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <div><p className="text-xl font-bold">{users.length}</p><p className="text-[10px] text-muted-foreground">Users</p></div>
            </div>
          </Card>
          <Card className="p-3 bg-card/50 backdrop-blur-xl border-border/30">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-primary" />
              <div><p className="text-xl font-bold">{pastes.length}</p><p className="text-[10px] text-muted-foreground">Pastes</p></div>
            </div>
          </Card>
          <Card className="p-3 bg-card/50 backdrop-blur-xl border-border/30">
            <div className="flex items-center gap-2">
              <Ban className="h-4 w-4 text-destructive" />
              <div><p className="text-xl font-bold">{users.filter(u => u.is_banned).length}</p><p className="text-[10px] text-muted-foreground">Banned</p></div>
            </div>
          </Card>
          <Card className="p-3 bg-card/50 backdrop-blur-xl border-border/30">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-yellow-500" />
              <div><p className="text-xl font-bold">{globalBans.filter(b => b.is_active).length}</p><p className="text-[10px] text-muted-foreground">Global Bans</p></div>
            </div>
          </Card>
          <Card className="p-3 bg-card/50 backdrop-blur-xl border-border/30">
            <div className="flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-destructive" />
              <div><p className="text-xl font-bold">{unresolvedThreats.length}</p><p className="text-[10px] text-muted-foreground">Threats</p></div>
            </div>
          </Card>
        </div>

        <Tabs defaultValue="threats" className="w-full">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="threats" type="button"><Crosshair className="h-3 w-3 mr-1" />Threats{unresolvedThreats.length > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1">{unresolvedThreats.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="global-bans" type="button"><ShieldAlert className="h-3 w-3 mr-1" />Global Bans</TabsTrigger>
            <TabsTrigger value="users" type="button"><Users className="h-3 w-3 mr-1" />Users</TabsTrigger>
            <TabsTrigger value="pastes" type="button"><FileCode className="h-3 w-3 mr-1" />Pastes</TabsTrigger>
            <TabsTrigger value="access-logs" type="button" onClick={fetchAccessLogs}><Database className="h-3 w-3 mr-1" />Access Logs</TabsTrigger>
            <TabsTrigger value="sessions" type="button" onClick={fetchSessions}><Clock className="h-3 w-3 mr-1" />Sessions</TabsTrigger>
            <TabsTrigger value="activity" type="button" onClick={fetchActivity}><Activity className="h-3 w-3 mr-1" />Activity</TabsTrigger>
            <TabsTrigger value="reviews" type="button" onClick={fetchReviews}><Star className="h-3 w-3 mr-1" />Reviews</TabsTrigger>
          </TabsList>

          {/* THREATS TAB */}
          <TabsContent value="threats" className="space-y-4 mt-6">
            <Card className="p-6 bg-card/50 backdrop-blur-xl border-border/30">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2"><Crosshair className="h-5 w-5" />Threat Detection</h2>
                <Button onClick={fetchThreats} variant="outline" size="sm"><RefreshCw className="h-3 w-3 mr-1" />Refresh</Button>
              </div>
              {threats.length === 0 ? (
                <div className="text-center py-12">
                  <ShieldCheck className="h-12 w-12 mx-auto text-green-500 mb-3" />
                  <p className="text-lg font-medium text-green-500">All Clear</p>
                  <p className="text-sm text-muted-foreground">No threats detected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {threats.map(threat => (
                    <Card key={threat.id} className={`p-4 ${threat.resolved ? 'opacity-50 border-border/20' : threat.severity === 'critical' ? 'border-destructive/50 bg-destructive/5' : threat.severity === 'high' ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-border/30'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={threat.severity === 'critical' ? 'destructive' : threat.severity === 'high' ? 'default' : 'secondary'} className="text-[10px]">
                              {threat.severity.toUpperCase()}
                            </Badge>
                            <span className="font-medium text-sm">{threat.threat_type}</span>
                            {threat.resolved && <Badge variant="outline" className="text-[10px] text-green-500">RESOLVED</Badge>}
                            {threat.auto_banned && <Badge variant="outline" className="text-[10px] text-destructive">AUTO-BANNED</Badge>}
                          </div>
                          {threat.source_ip && <p className="text-xs font-mono text-muted-foreground">IP: {threat.source_ip}</p>}
                          {threat.roblox_user_id && <p className="text-xs text-muted-foreground">Roblox ID: {threat.roblox_user_id}</p>}
                          {threat.discord_user_id && <p className="text-xs text-muted-foreground">Discord ID: {threat.discord_user_id}</p>}
                          {threat.details && Object.keys(threat.details).length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">{JSON.stringify(threat.details)}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground">{new Date(threat.created_at).toLocaleString()}</p>
                        </div>
                        {!threat.resolved && (
                          <div className="flex flex-col gap-1.5">
                            <Button size="sm" variant="destructive" onClick={() => handleAutoBanThreat(threat)} className="text-xs">
                              <Skull className="h-3 w-3 mr-1" />Ban All
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleResolveThreat(threat.id)} className="text-xs">
                              <ShieldCheck className="h-3 w-3 mr-1" />Resolve
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* GLOBAL BANS TAB */}
          <TabsContent value="global-bans" className="space-y-4 mt-6">
            <Card className="p-6 bg-card/50 backdrop-blur-xl border-border/30">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4"><ShieldAlert className="h-5 w-5" />Global Ban Management</h2>
              <p className="text-xs text-muted-foreground mb-4">Globally banned IPs/Roblox IDs/Discord IDs are blocked from ALL pastes and site access.</p>
              {/* Add ban form */}
              <div className="flex flex-wrap gap-2 mb-6 p-4 bg-muted/20 rounded-lg border border-border/30">
                <select value={newBanType} onChange={e => setNewBanType(e.target.value)} className="bg-background border border-border rounded px-3 py-2 text-sm">
                  <option value="ip">IP Address</option>
                  <option value="subnet">Subnet (e.g. 79.177.154.)</option>
                  <option value="roblox_id">Roblox User ID</option>
                  <option value="discord_id">Discord User ID</option>
                </select>
                <Input placeholder="Value to ban..." value={newBanValue} onChange={e => setNewBanValue(e.target.value)} className="flex-1 min-w-[200px]" />
                <Input placeholder="Reason (optional)" value={newBanReason} onChange={e => setNewBanReason(e.target.value)} className="flex-1 min-w-[150px]" />
                <Button onClick={handleAddGlobalBan} variant="destructive"><Ban className="h-4 w-4 mr-1" />Add Ban</Button>
              </div>
              {/* Active bans */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{globalBans.filter(b => b.is_active).length} active bans</p>
                  <Button onClick={fetchGlobalBans} variant="ghost" size="sm"><RefreshCw className="h-3 w-3" /></Button>
                </div>
                {globalBans.filter(b => b.is_active).map(ban => (
                  <div key={ban.id} className="flex items-center justify-between p-3 bg-muted/10 rounded border border-border/20">
                    <div className="flex items-center gap-3">
                      <Badge variant={ban.ban_type === 'ip' ? 'destructive' : ban.ban_type === 'subnet' ? 'default' : 'secondary'} className="text-[10px]">
                        {ban.ban_type.toUpperCase()}
                      </Badge>
                      <span className="font-mono text-sm">{ban.ban_value}</span>
                      {ban.reason && <span className="text-xs text-muted-foreground">— {ban.reason}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{new Date(ban.banned_at).toLocaleDateString()}</span>
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveGlobalBan(ban.id)} className="text-xs text-destructive hover:text-destructive"><XCircle className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* USERS TAB */}
          <TabsContent value="users" className="space-y-4 mt-6">
            <Card className="p-6 bg-card/50 backdrop-blur-xl border-border/30">
              <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by email, Discord, or IP..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
                <Button onClick={fetchUsers} variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
              </div>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{filteredUsers.length} users</p>
                  {filteredUsers.map(user => (
                    <Card key={user.id} className={`p-4 ${user.is_banned ? 'border-destructive/50 bg-destructive/10' : 'border-border/30'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">{user.email}</p>
                            {user.is_banned && <span className="text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded">BANNED</span>}
                          </div>
                          {user.discord_username && <p className="text-xs text-muted-foreground">Discord: {user.discord_username}</p>}
                          <p className="text-xs text-muted-foreground">Joined: {new Date(user.created_at).toLocaleDateString()} · Last: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}</p>
                          <p className="text-xs text-muted-foreground font-mono text-[10px]">ID: {user.id}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {user.ip_addresses.map((ip, idx) => (
                              <span key={idx} className={`text-xs font-mono px-2 py-0.5 rounded cursor-pointer hover:bg-primary/20 ${ip.is_primary ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`} onClick={() => handleCopy(ip.address)}>
                                {ip.address}{ip.is_primary ? ' ★' : ''}
                              </span>
                            ))}
                          </div>
                          {user.ban_reason && <p className="text-xs text-destructive mt-1">Reason: {user.ban_reason}</p>}
                        </div>
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          {user.is_banned ? (
                            <Button size="sm" variant="outline" onClick={() => handleUnbanUser(user.id)} className="text-xs">Unban</Button>
                          ) : (
                            selectedUserId === user.id ? (
                              <div className="flex flex-col gap-1.5">
                                <Input placeholder="Reason..." value={banReason} onChange={e => setBanReason(e.target.value)} className="text-xs h-8 w-32" />
                                <Button size="sm" variant="destructive" onClick={() => handleBanUser(user.id)} className="text-xs"><Ban className="h-3 w-3 mr-1" />Ban</Button>
                                <Button size="sm" variant="ghost" onClick={() => { setSelectedUserId(null); setBanReason(""); }} className="text-xs">Cancel</Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => setSelectedUserId(user.id)} className="text-xs"><Ban className="h-3 w-3 mr-1" />Ban</Button>
                            )
                          )}
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteUser(user.id)} className="text-xs"><Trash2 className="h-3 w-3 mr-1" />Delete</Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* PASTES TAB */}
          <TabsContent value="pastes" className="space-y-4 mt-6">
            <Card className="p-6 bg-card/50 backdrop-blur-xl border-border/30">
              <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search pastes..." value={pasteSearch} onChange={e => setPasteSearch(e.target.value)} className="pl-10" />
                </div>
                <Button onClick={fetchPastes} variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{filteredPastes.length} pastes</p>
                {filteredPastes.map(paste => (
                  <Card key={paste.id} className="p-4 border-border/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <p className="font-medium text-sm">{paste.title || paste.slug}</p>
                        <p className="text-xs text-muted-foreground">Slug: <span className="font-mono">{paste.slug}</span> · Owner: {paste.owner_email}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(paste.created_at).toLocaleDateString()} · {paste.protection_enabled ? '🛡️ Protected' : '🔓 Open'}</p>
                        {expandedPaste === paste.id && (
                          <pre className="mt-2 p-3 bg-muted/20 rounded text-xs max-h-40 overflow-auto font-mono">{paste.content.substring(0, 2000)}</pre>
                        )}
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => setExpandedPaste(expandedPaste === paste.id ? null : paste.id)}>{expandedPaste === paste.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</Button>
                        <Button size="sm" variant="ghost" onClick={() => handleCopy(paste.content)}><Copy className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDownloadPaste(paste)}><Download className="h-3 w-3" /></Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeletePaste(paste.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* ACCESS LOGS TAB */}
          <TabsContent value="access-logs" className="space-y-4 mt-6">
            <Card className="p-6 bg-card/50 backdrop-blur-xl border-border/30">
              <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by IP, Roblox user, paste..." value={logSearch} onChange={e => setLogSearch(e.target.value)} className="pl-10" />
                </div>
                <Button onClick={fetchAccessLogs} variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
              </div>
              {dbLoading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{filteredLogs.length} logs</p>
                  {filteredLogs.slice(0, 100).map(log => (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-muted/10 rounded border border-border/20 text-xs">
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono">{log.ip_address}</span>
                          <Badge variant={log.access_type === 'execution' ? 'default' : 'secondary'} className="text-[10px]">{log.access_type}</Badge>
                          {log.is_active && <span className="h-2 w-2 rounded-full bg-green-500" />}
                        </div>
                        <p className="text-muted-foreground">
                          {log.roblox_username && `Roblox: ${log.roblox_username} (${log.roblox_user_id}) · `}
                          Paste: {log.paste_slug} · Owner: {log.paste_owner_email}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{new Date(log.last_seen_at).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleCopy(log.ip_address)} className="h-6 px-2"><Copy className="h-3 w-3" /></Button>
                        {log.ip_address && (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-destructive" onClick={() => { setNewBanType('ip'); setNewBanValue(log.ip_address); }}><Ban className="h-3 w-3" /></Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* SESSIONS TAB */}
          <TabsContent value="sessions" className="space-y-4 mt-6">
            <Card className="p-6 bg-card/50 backdrop-blur-xl border-border/30">
              <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search sessions..." value={sessionSearch} onChange={e => setSessionSearch(e.target.value)} className="pl-10" />
                </div>
                <Button onClick={fetchSessions} variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
              </div>
              {dbLoading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : (
                <div className="space-y-2">
                  {filteredSessions.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-muted/10 rounded border border-border/20 text-xs">
                      <div>
                        <p className="font-medium">{s.user_email}</p>
                        <p className="text-muted-foreground font-mono">{s.ip_address || 'No IP'} · Last: {new Date(s.last_active).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* ACTIVITY TAB */}
          <TabsContent value="activity" className="space-y-4 mt-6">
            <Card className="p-6 bg-card/50 backdrop-blur-xl border-border/30">
              <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search activity..." value={activitySearch} onChange={e => setActivitySearch(e.target.value)} className="pl-10" />
                </div>
                <Button onClick={fetchActivity} variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
              </div>
              {dbLoading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : (
                <div className="space-y-2">
                  {filteredActivity.slice(0, 100).map(a => (
                    <div key={a.id} className="flex items-center justify-between p-3 bg-muted/10 rounded border border-border/20 text-xs">
                      <div>
                        <p className="font-medium">{a.user_email} <Badge variant="secondary" className="text-[10px] ml-1">{a.activity_type}</Badge></p>
                        <p className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* REVIEWS TAB */}
          <TabsContent value="reviews" className="space-y-4 mt-6">
            <Card className="p-6 bg-card/50 backdrop-blur-xl border-border/30">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Reviews</h2>
                <Button onClick={fetchReviews} variant="outline" size="sm"><RefreshCw className="h-3 w-3 mr-1" />Refresh</Button>
              </div>
              {dbLoading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : (
                <div className="space-y-2">
                  {reviews.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-3 bg-muted/10 rounded border border-border/20 text-xs">
                      <div>
                        <p className="font-medium">{r.username} · {'⭐'.repeat(r.stars)}{r.is_fake && ' (FAKE)'}</p>
                        <p className="text-muted-foreground">{r.content.substring(0, 100)}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteReview(r.id)} className="text-destructive"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
