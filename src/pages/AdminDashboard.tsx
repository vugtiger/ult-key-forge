import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Trash2, Search, Ban, Copy, Download, Users, FileCode, Globe, RefreshCw } from "lucide-react";
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

const AdminDashboard = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pastes, setPastes] = useState<AdminPaste[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [pasteSearch, setPasteSearch] = useState("");
  const [banReason, setBanReason] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setCurrentUserId(session.user.id);
      }
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

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to permanently delete this user and all their data?')) return;
    try {
      await adminCall('delete_user', { target_user_id: userId });
      toast({ title: "User Deleted", description: "Account has been permanently removed." });
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

  const handleCopyPaste = (content: string) => {
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

  if (adminLoading || !isAdmin) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Owner Dashboard</h1>
            <p className="text-sm text-muted-foreground">Full control over all accounts and data</p>
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
          <TabsList className="grid w-full max-w-lg grid-cols-3" onClick={(e) => e.stopPropagation()}>
            <TabsTrigger value="users" type="button">
              <Users className="h-4 w-4 mr-2" />Users
            </TabsTrigger>
            <TabsTrigger value="pastes" type="button">
              <FileCode className="h-4 w-4 mr-2" />Pastes
            </TabsTrigger>
            <TabsTrigger value="ips" type="button">
              <Globe className="h-4 w-4 mr-2" />IP Tracking
            </TabsTrigger>
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
                          <p className="text-xs text-muted-foreground">Joined: {new Date(user.created_at).toLocaleDateString()}</p>
                          {user.last_sign_in_at && <p className="text-xs text-muted-foreground">Last login: {new Date(user.last_sign_in_at).toLocaleString()}</p>}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {user.ip_addresses.map((ip, idx) => (
                              <span key={idx} className={`text-xs font-mono px-2 py-0.5 rounded ${ip.is_primary ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                {ip.address} {ip.is_primary ? '(primary)' : ''}
                              </span>
                            ))}
                            {user.ip_addresses.length === 0 && <span className="text-xs text-muted-foreground">No IPs</span>}
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
                  <Input placeholder="Search pastes..." value={pasteSearch} onChange={(e) => setPasteSearch(e.target.value)} className="pl-10" />
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
                        <p className="text-xs text-muted-foreground">Owner: {paste.owner_email}</p>
                        <p className="text-xs text-muted-foreground">Slug: /{paste.slug}</p>
                        <p className="text-xs text-muted-foreground">
                          {paste.protection_enabled ? '🛡️ Protected' : '🔓 Unprotected'} · 
                          Created: {new Date(paste.created_at).toLocaleDateString()}
                        </p>
                        <pre className="text-xs text-muted-foreground bg-muted/50 rounded p-2 mt-2 max-h-24 overflow-auto whitespace-pre-wrap">
                          {paste.content.substring(0, 500)}{paste.content.length > 500 ? '...' : ''}
                        </pre>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <Button size="sm" variant="outline" onClick={() => handleCopyPaste(paste.content)} className="text-xs">
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
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(ip.last_used).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
