import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Shield, Globe, User, MessageCircle } from "lucide-react";
import BannedIPsTab from "@/components/access-monitor/BannedIPsTab";
import BannedUsersTab from "@/components/access-monitor/BannedUsersTab";
import BannedDiscordTab from "@/components/access-monitor/BannedDiscordTab";

const OwnerBansManager = () => {
  const [bannedIps, setBannedIps] = useState<any[]>([]);
  const [bannedRoblox, setBannedRoblox] = useState<any[]>([]);
  const [bannedDiscord, setBannedDiscord] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBans();
  }, []);

  const fetchBans = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('owner-bans', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!error && data) {
        setBannedIps(data.banned_ips || []);
        // Split users into Roblox and Discord
        const roblox: any[] = [];
        const discord: any[] = [];
        for (const user of (data.banned_users || [])) {
          if (user.roblox_user_id) {
            roblox.push(user);
          }
          if (user.discord_user_id) {
            discord.push({
              discord_user_id: user.discord_user_id,
              discord_username: user.discord_username,
              discord_avatar: user.discord_avatar,
              discord_created_at: user.discord_created_at,
              ip_address: user.ip_address,
              last_seen_at: user.last_seen_at,
              ban_reason: user.ban_reason,
              banned_at: user.banned_at,
              roblox_user_id: user.roblox_user_id,
              roblox_username: user.roblox_username,
            });
          }
        }
        setBannedRoblox(roblox);
        setBannedDiscord(discord);
      }
    } catch (err) {
      console.error('Failed to fetch bans:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="cyber-border bg-card/50 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-destructive" />
          Banned Users & IPs
          <Badge variant="outline" className="text-xs ml-2">
            {bannedIps.length + bannedRoblox.length + bannedDiscord.length} total
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ips" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-9 bg-background/30 border border-primary/10 rounded-lg p-0.5">
            <TabsTrigger value="ips" type="button" className="flex items-center gap-1.5 text-xs rounded-md data-[state=active]:bg-destructive/15 data-[state=active]:text-foreground">
              <Globe className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Banned IPs</span>
              <span className="sm:hidden">IPs</span>
              {bannedIps.length > 0 && <Badge variant="destructive" className="text-[9px] px-1 py-0 ml-1">{bannedIps.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="roblox" type="button" className="flex items-center gap-1.5 text-xs rounded-md data-[state=active]:bg-destructive/15 data-[state=active]:text-foreground">
              <User className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Roblox IDs</span>
              <span className="sm:hidden">Roblox</span>
              {bannedRoblox.length > 0 && <Badge variant="destructive" className="text-[9px] px-1 py-0 ml-1">{bannedRoblox.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="discord" type="button" className="flex items-center gap-1.5 text-xs rounded-md data-[state=active]:bg-[#5865F2]/15 data-[state=active]:text-foreground">
              <MessageCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Discord</span>
              <span className="sm:hidden">Discord</span>
              {bannedDiscord.length > 0 && <Badge variant="destructive" className="text-[9px] px-1 py-0 ml-1">{bannedDiscord.length}</Badge>}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="ips" className="mt-4">
            <BannedIPsTab ips={bannedIps} loading={loading} />
          </TabsContent>
          <TabsContent value="roblox" className="mt-4">
            <BannedUsersTab users={bannedRoblox} loading={loading} />
          </TabsContent>
          <TabsContent value="discord" className="mt-4">
            <BannedDiscordTab users={bannedDiscord} loading={loading} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default OwnerBansManager;
