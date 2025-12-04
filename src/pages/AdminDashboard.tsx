import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Trash2, Search, Ban } from "lucide-react";

interface UserWithIP {
  user_id: string;
  email: string;
  discord_username: string | null;
  ip_addresses: string[];
  is_banned: boolean;
  created_at: string;
}

const AdminDashboard = () => {
  const [users, setUsers] = useState<UserWithIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [banReason, setBanReason] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Get all profiles with their IPs
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, discord_username, is_banned, created_at');

      if (profilesError) throw profilesError;

      // Get all IPs
      const { data: ips, error: ipsError } = await supabase
        .from('user_ips')
        .select('user_id, ip_address');

      if (ipsError) throw ipsError;

      // Combine data
      const usersWithIPs: UserWithIP[] = (profiles || []).map(profile => ({
        user_id: profile.id,
        email: profile.username || 'Unknown',
        discord_username: profile.discord_username,
        ip_addresses: (ips || [])
          .filter(ip => ip.user_id === profile.id)
          .map(ip => ip.ip_address),
        is_banned: profile.is_banned || false,
        created_at: profile.created_at || ''
      }));

      setUsers(usersWithIPs);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (userId: string) => {
    if (!banReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for the ban",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_banned: true,
          banned_at: new Date().toISOString(),
          ban_reason: banReason
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User has been banned",
      });

      setBanReason("");
      setSelectedUserId(null);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_banned: false,
          banned_at: null,
          ban_reason: null
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User has been unbanned",
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.discord_username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.ip_addresses.some(ip => ip.includes(searchTerm))
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="ips">IP Tracking</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4 mt-6">
            <Card className="p-6 cyber-border bg-card/50 backdrop-blur-xl">
              <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email, Discord, or IP..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button onClick={fetchUsers} variant="outline">
                  Refresh
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading users...</div>
              ) : (
                <div className="space-y-4">
                  {filteredUsers.map((user) => (
                    <Card key={user.user_id} className={`p-4 ${user.is_banned ? 'border-destructive/50 bg-destructive/10' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{user.email}</p>
                            {user.is_banned && (
                              <span className="text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded">
                                BANNED
                              </span>
                            )}
                          </div>
                          {user.discord_username && (
                            <p className="text-sm text-muted-foreground">
                              Discord: {user.discord_username}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            IPs: {user.ip_addresses.length > 0 ? user.ip_addresses.join(', ') : 'No IPs recorded'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Joined: {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          {user.is_banned ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUnbanUser(user.user_id)}
                            >
                              Unban
                            </Button>
                          ) : (
                            <>
                              {selectedUserId === user.user_id ? (
                                <div className="flex flex-col gap-2">
                                  <Input
                                    placeholder="Ban reason..."
                                    value={banReason}
                                    onChange={(e) => setBanReason(e.target.value)}
                                    className="text-sm"
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleBanUser(user.user_id)}
                                    >
                                      <Ban className="h-4 w-4 mr-1" />
                                      Confirm
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedUserId(null);
                                        setBanReason("");
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setSelectedUserId(user.user_id)}
                                >
                                  <Ban className="h-4 w-4 mr-1" />
                                  Ban User
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                  {filteredUsers.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No users found</p>
                  )}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="ips" className="space-y-4 mt-6">
            <Card className="p-6 cyber-border bg-card/50 backdrop-blur-xl">
              <h3 className="text-lg font-semibold mb-4">IP Address Tracking</h3>
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.user_id} className="border-b border-border pb-4 last:border-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{user.email}</p>
                        {user.discord_username && (
                          <p className="text-sm text-muted-foreground">
                            Discord: {user.discord_username}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {user.ip_addresses.length > 0 ? (
                          <div className="space-y-1">
                            {user.ip_addresses.map((ip, idx) => (
                              <p key={idx} className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                {ip}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No IPs recorded</p>
                        )}
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
