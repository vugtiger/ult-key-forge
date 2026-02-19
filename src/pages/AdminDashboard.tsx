import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Trash2, Search, Ban, Copy, Download, Users, FileCode, Globe, RefreshCw, Activity, Star, Clock, Database, Eye, EyeOff, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdminStatus } from "@/hooks/useAdminStatus";

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
  id: string;
  title: string | null;
  slug: string;
  content: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  protection_enabled: boolean;
  owner_email: string;
}

interface AccessLog {
  id: string;
  paste_id: string;
  paste_slug: string;
  paste_title: string;
  paste_owner_email: string;
  ip_address: string;
  roblox_user_id: string | null;
  roblox_username: string | null;
  roblox_avatar_url: string | null;
  discord_username: string | null;
  access_type: string;
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
  user_agent: string | null;
}

interface UserSession {
  id: string;
  user_id: string;
  user_email: string;
  session_token: string;
  ip_address: string | null;
  user_agent: string | null;
  last_active: string;
  created_at: string;
}

interface UserActivityRecord {
  id: string;
  user_id: string;
  user_email: string;
  activity_type: string;
  activity_data: any;
  created_at: string;
}

interface Review {
  id: string;
  user_id: string | null;
  username: string;
  content: string;
  stars: number;
  is_fake: boolean;
  created_at: string;
}

const AdminDashboard = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pastes, setPastes] = useState<AdminPaste[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [activity, setActivity] = useState<UserActivityRecord[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
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
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setCurrentUserId(session.user.id);
    });
  }, []);

  const { isAdmin, loading: adminLoading } = useAdminStatus(currentUserId || undefined);

  useEffect(() => {
    if (!adminLoading && !isAdmin && currentUserId) {
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, currentUserId, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchPastes();
    }
  }, [isAdmin]);

  const adminCall = async (action: string, params: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke('admin-api', {
      body: { action, ...params }
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await adminCall('list_users');
      setUsers(data.users || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchPastes = async () => {
    try {
      const data = await adminCall('list_pastes');
      setPastes(data.pastes || []);
    } catch (error: any) {
      console.error('Error fetching pastes:', error);
    }
  };

  const fetchAccessLogs = async () => {
    setDbLoading(true);
    try {
      const data = await adminCall('list_access_logs');
      setAccessLogs(data.logs || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDbLoading(false);
    }
  };

  const fetchSessions = async () => {
    setDbLoading(true);
    try {
      const data = await adminCall('list_sessions');
      setSessions(data.sessions || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDbLoading(false);
    }
  };

  const fetchActivity = async () => {
    setDbLoading(true);
    try {
      const data = await adminCall('list_activity');
      setActivity(data.activity || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDbLoading(false);
    }
  };

  const fetchReviews = async () => {
    setDbLoading(true);
    try {
      const data = await adminCall('list_reviews');
      setReviews(data.reviews || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDbLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Permanently delete this user and all their data?')) return;
    try {
      await adminCall('delete_user', { target_user_id: userId });
      toast({ title: "User Deleted" });
      fetchUsers();
      fetchPastes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleBanUser = async (userId: string) => {
    if (!banReason.trim()) {
      toast({ title: "Error", description: "Please provide a ban reason", variant: "destructive" });
      return;
    }
    try {
      await adminCall('ban_user', { target_user_id: userId, reason: banReason });
      toast({ title: "User Banned" });
      setBanReason("");
      setSelectedUserId(null);
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      await adminCall('unban_user', { target_user_id: userId });
      toast({ title: "User Unbanned" });
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeletePaste = async (pasteId: string) => {
    if (!confirm('Delete this paste permanently?')) return;
    try {
      await adminCall('delete_paste', { paste_id: pasteId });
      toast({ title: "Paste Deleted" });
      fetchPastes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      await adminCall('delete_review', { review_id: reviewId });
      toast({ title: "Review Deleted" });
      setReviews(prev => prev.filter(r => r.id !== reviewId));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard" });
  };

  const handleDownloadPaste = (paste: AdminPaste) => {
    const blob = new Blob([paste.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${paste.title || paste.slug}.lua`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredUsers = users.filter(u =>
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.discord_username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.ip_addresses.some(ip => ip.address.includes(searchTerm))
  );

  const filteredPastes = pastes.filter(p =>
    (p.title || '').toLowerCase().includes(pasteSearch.toLowerCase()) ||
    p.slug.toLowerCase().includes(pasteSearch.toLowerCase()) ||
    p.owner_email.toLowerCase().includes(pasteSearch.toLowerCase()) ||
    p.content.toLowerCase().includes(pasteSearch.toLowerCase())
  );

  const filteredLogs = accessLogs.filter(l =>
    l.ip_address?.includes(logSearch) ||
    l.roblox_username?.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.paste_slug?.includes(logSearch) ||
    l.paste_owner_email?.toLowerCase().includes(logSearch.toLowerCase())
  );

  const filteredSessions = sessions.filter(s =>
    s.user_email?.toLowerCase().includes(sessionSearch.toLowerCase()) ||
    s.ip_address?.includes(sessionSearch)
  );

  const filteredActivity = activity.filter(a =>
    a.user_email?.toLowerCase().includes(activitySearch.toLowerCase()) ||
    a.activity_type?.toLowerCase().includes(activitySearch.toLowerCase())
  );

  if (adminLoading || !isAdmin) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Owner Dashboard</h1>
            <p className="text-sm text-muted-foreground">Full control over all accounts, data, and activity</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-card/50 backdrop-blur-xl border-border/30">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-card/50 backdrop-blur-xl border-border/30">
            <div className="flex items-center gap-3">
              <FileCode className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{pastes.length}</p>
                <p className="text-xs text-muted-foreground">Total Pastes</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-card/50 backdrop-blur-xl border-border/30">
            <div className="flex items-center gap-3">
              <Ban className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{users.filter(u => u.is_banned).length}</p>
                <p className="text-xs text-muted-foreground">Banned</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-card/50 backdrop-blur-xl border-border/30">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{users.reduce((sum, u) => sum + u.ip_addresses.length, 0)}</p>
                <p className="text-xs text-muted-foreground">IPs Tracked</p>
              </div>
            </div>
          </Card>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="users" type="button"><Users className="h-3 w-3 mr-1" />Users</TabsTrigger>
            <TabsTrigger value="pastes" type="button"><FileCode className="h-3 w-3 mr-1" />Pastes</TabsTrigger>
            <TabsTrigger value="ips" type="button"><Globe className="h-3 w-3 mr-1" />IPs</TabsTrigger>
            <TabsTrigger value="access-logs" type="button" onClick={fetchAccessLogs}><Database className="h-3 w-3 mr-1" />Access Logs</TabsTrigger>
            <TabsTrigger value="sessions" type="button" onClick={fetchSessions}><Clock className="h-3 w-3 mr-1" />Sessions</TabsTrigger>
            <TabsTrigger value="activity" type="button" onClick={fetchActivity}><Activity className="h-3 w-3 mr-1" />Activity</TabsTrigger>
            <TabsTrigger value="reviews" type="button" onClick={fetchReviews}><Star className="h-3 w-3 mr-1" />Reviews</TabsTrigger>
          </TabsList>

          {/* USERS TAB */}
          <TabsContent value="users" className="space-y-4 mt-6">
            <Card className="p-6 bg-card/50 backdrop-blur-xl border-border/30">
              <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by email, Discord, or IP..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
                <Button onClick={fetchUsers} variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
              </div>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading users...</div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{filteredUsers.length} users found</p>
                  {filteredUsers.map((user) => (
                    <Card key={user.id} className={`p-4 ${user.is_banned ? 'border-destructive/50 bg-destructive/10' : 'border-border/30'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">{user.email}</p>
                            {user.is_banned && <span className="text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded">BANNED</span>}
                          </div>
                          {user.discord_username && <p className="text-xs text-muted-foreground">Discord: {user.discord_username}</p>}
                          <p className="text-xs text-muted-foreground">Joined: {new Date(user.created_at).toLocaleDateString()} · Last login: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}</p>
                          <p className="text-xs text-muted-foreground">ID: <span className="font-mono text-[10px]">{user.id}</span></p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {user.ip_addresses.map((ip, idx) => (
                              <span key={idx} className={`text-xs font-mono px-2 py-0.5 rounded ${ip.is_primary ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                {ip.address} {ip.is_primary ? '(primary)' : ''}
                              </span>
                            ))}
                            {user.ip_addresses.length === 0 && <span className="text-xs text-muted-foreground italic">No IPs recorded</span>}
                          </div>
                          {user.ban_reason && <p className="text-xs text-destructive mt-1">Reason: {user.ban_reason}</p>}
                        </div>
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          {user.is_banned ? (
                            <Button size="sm" variant="outline" onClick={() => handleUnbanUser(user.id)} className="text-xs">Unban</Button>
                          ) : (
                            <>
                              {selectedUserId === user.id ? (
                                <div className="flex flex-col gap-1.5">
                                  <Input placeholder="Reason..." value={banReason} onChange={(e) => setBanReason(e.target.value)} className="text-xs h-8 w-32" />
                                  <Button size="sm" variant="destructive" onClick={() => handleBanUser(user.id)} className="text-xs"><Ban className="h-3 w-3 mr-1" />Ban</Button>
                                  <Button size="sm" variant="ghost" onClick={() => { setSelectedUserId(null); setBanReason(""); }} className="text-xs">Cancel</Button>
                                </div>
                              ) : (
                                <Button size="sm" variant="outline" onClick={() => setSelectedUserId(user.id)} className="text-xs"><Ban className="h-3 w-3 mr-1" />Ban</Button>
                              )}
                            </>
                          )}
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteUser(user.id)} className="text-xs">
                            <Trash2 className="h-3 w-3 mr-1" />Delete
                          </Button>
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
                  <Input placeholder="Search by title, slug, owner email, or code..." value={pasteSearch} onChange={(e) => setPasteSearch(e.target.value)} className="pl-10" />
                </div>
                <Button onClick={fetchPastes} variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{filteredPastes.length} pastes found</p>
                {filteredPastes.map((paste) => (
                  <Card key={paste.id} className="p-4 border-border/30">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <p className="font-medium text-sm">{paste.title || paste.slug}</p>
                        <p className="text-xs text-muted-foreground font-mono">Owner: <span className="text-foreground">{paste.owner_email}</span></p>
                        <p className="text-xs text-muted-foreground">Slug: /{paste.slug} · {paste.protection_enabled ? '🛡️ Protected' : '🔓 Unprotected'} · {new Date(paste.created_at).toLocaleDateString()}</p>
                        {expandedPaste === paste.id ? (
                          <pre className="text-xs bg-muted/50 rounded p-2 mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono">
                            {paste.content}
                          </pre>
                        ) : (
                          <pre className="text-xs text-muted-foreground bg-muted/50 rounded p-2 mt-2 max-h-16 overflow-hidden whitespace-pre-wrap">
                            {paste.content.substring(0, 200)}{paste.content.length > 200 ? '...' : ''}
                          </pre>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <Button size="sm" variant="outline" onClick={() => setExpandedPaste(expandedPaste === paste.id ? null : paste.id)} className="text-xs">
                          {expandedPaste === paste.id ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {expandedPaste === paste.id ? 'Hide' : 'View'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleCopy(paste.content)} className="text-xs">
                          <Copy className="h-3 w-3 mr-1" />Copy
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDownloadPaste(paste)} className="text-xs">
                          <Download className="h-3 w-3 mr-1" />Download
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeletePaste(paste.id)} className="text-xs">
                          <Trash2 className="h-3 w-3 mr-1" />Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* IP TAB */}
          <TabsContent value="ips" className="space-y-4 mt-6">
            <Card className="p-6 bg-card/50 backdrop-blur-xl border-border/30">
              <h3 className="text-lg font-semibold mb-4">All IP Addresses</h3>
              <div className="space-y-4">
                {users.filter(u => u.ip_addresses.length > 0).map((user) => (
                  <div key={user.id} className="border-b border-border/30 pb-4 last:border-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{user.email}</p>
                        {user.discord_username && <p className="text-xs text-muted-foreground">Discord: {user.discord_username}</p>}
                      </div>
                      <div className="text-right space-y-1">
                        {user.ip_addresses.map((ip, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <p className={`text-xs font-mono px-2 py-1 rounded ${ip.is_primary ? 'bg-primary/20 text-primary' : 'bg-muted'}`}>
                              {ip.address}
                            </p>
                            <span className="text-[10px] text-muted-foreground">{new Date(ip.last_used).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
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
                  <Input placeholder="Search by IP, Roblox user, paste slug, or owner email..." value={logSearch} onChange={(e) => setLogSearch(e.target.value)} className="pl-10" />
                </div>
                <Button onClick={fetchAccessLogs} variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
              </div>
              {dbLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading access logs...</div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{filteredLogs.length} logs found</p>
                  {filteredLogs.map((log) => (
                    <Card key={log.id} className="p-3 border-border/30">
                      <div className="flex items-start gap-3">
                        {log.roblox_avatar_url && (
                          <img src={log.roblox_avatar_url} alt="" className="w-10 h-10 rounded-full shrink-0" />
                        )}
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{log.roblox_username || 'Unknown'}</span>
                            {log.discord_username && <span className="text-xs text-muted-foreground">(@{log.discord_username})</span>}
                            <span className={`text-xs px-1.5 py-0.5 rounded ${log.is_active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                              {log.is_active ? '🟢 Active' : '⚫ Inactive'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">Paste: <span className="text-foreground">{log.paste_slug}</span> · Owner: {log.paste_owner_email}</p>
                          <p className="text-xs font-mono text-muted-foreground">IP: {log.ip_address} · RBX ID: {log.roblox_user_id || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {filteredLogs.length === 0 && !dbLoading && (
                    <p className="text-center py-8 text-muted-foreground">No access logs found. Click refresh to load.</p>
                  )}
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
                  <Input placeholder="Search by email or IP..." value={sessionSearch} onChange={(e) => setSessionSearch(e.target.value)} className="pl-10" />
                </div>
                <Button onClick={fetchSessions} variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
              </div>
              {dbLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{filteredSessions.length} sessions found</p>
                  {filteredSessions.map((session) => (
                    <Card key={session.id} className="p-3 border-border/30">
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <p className="font-medium text-sm">{session.user_email}</p>
                          <p className="text-xs font-mono text-muted-foreground">IP: {session.ip_address || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-xs">{session.user_agent || 'Unknown UA'}</p>
                          <p className="text-xs text-muted-foreground">Last active: {new Date(session.last_active).toLocaleString()} · Created: {new Date(session.created_at).toLocaleDateString()}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleCopy(session.session_token)} className="text-xs shrink-0">
                          <Copy className="h-3 w-3 mr-1" />Token
                        </Button>
                      </div>
                    </Card>
                  ))}
                  {filteredSessions.length === 0 && !dbLoading && (
                    <p className="text-center py-8 text-muted-foreground">No sessions found. Click refresh to load.</p>
                  )}
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
                  <Input placeholder="Search by email or activity type..." value={activitySearch} onChange={(e) => setActivitySearch(e.target.value)} className="pl-10" />
                </div>
                <Button onClick={fetchActivity} variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
              </div>
              {dbLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading activity...</div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{filteredActivity.length} records found</p>
                  {filteredActivity.map((item) => (
                    <Card key={item.id} className="p-3 border-border/30">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{item.user_email}</span>
                            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded font-mono">{item.activity_type}</span>
                          </div>
                          {item.activity_data && Object.keys(item.activity_data).length > 0 && (
                            <p className="text-xs text-muted-foreground font-mono">{JSON.stringify(item.activity_data).substring(0, 120)}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {filteredActivity.length === 0 && !dbLoading && (
                    <p className="text-center py-8 text-muted-foreground">No activity found. Click refresh to load.</p>
                  )}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* REVIEWS TAB */}
          <TabsContent value="reviews" className="space-y-4 mt-6">
            <Card className="p-6 bg-card/50 backdrop-blur-xl border-border/30">
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-muted-foreground">{reviews.length} total reviews</p>
                <Button onClick={fetchReviews} variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
              </div>
              {dbLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading reviews...</div>
              ) : (
                <div className="space-y-2">
                  {reviews.map((review) => (
                    <Card key={review.id} className="p-3 border-border/30">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{review.username}</span>
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5].map(n => (
                                <Star key={n} className={`h-3 w-3 ${n <= review.stars ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                              ))}
                            </div>
                            {review.is_fake && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">fake</span>}
                            {!review.is_fake && <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">real</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">{review.content}</p>
                          <p className="text-xs text-muted-foreground">{new Date(review.created_at).toLocaleString()}</p>
                        </div>
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteReview(review.id)} className="text-xs shrink-0">
                          <XCircle className="h-3 w-3 mr-1" />Delete
                        </Button>
                      </div>
                    </Card>
                  ))}
                  {reviews.length === 0 && !dbLoading && (
                    <p className="text-center py-8 text-muted-foreground">No reviews found. Click refresh to load.</p>
                  )}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
