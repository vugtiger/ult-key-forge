import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Shield, Trash2, Search, Ban, Copy, Download, Users, FileCode, Globe,
  RefreshCw, Activity, Star, Clock, Database, Eye, EyeOff, XCircle,
  AlertTriangle, ShieldAlert, ShieldCheck, Crosshair, Skull, LogOut,
  ChevronRight, Zap, Lock, Unlock, Bot, ShieldBan
} from "lucide-react";
import JarvisVoice from "@/components/JarvisVoice";
import BannedUsersTab from "@/components/access-monitor/BannedUsersTab";
import BannedIPsTab from "@/components/access-monitor/BannedIPsTab";
import { useNavigate } from "react-router-dom";

// Types
interface AdminUser {
  id: string; email: string; created_at: string; last_sign_in_at: string | null;
  discord_username: string | null; is_banned: boolean; ban_reason: string | null;
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

// Stat Card component
const StatCard = ({ icon: Icon, label, value, color = "text-primary" }: { icon: any; label: string; value: number | string; color?: string }) => (
  <div className="relative group">
    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    <div className="relative flex items-center gap-4 p-5 rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm">
      <div className={`flex items-center justify-center w-11 h-11 rounded-lg bg-muted/30 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-[11px] text-muted-foreground uppercase tracking-widest">{label}</p>
      </div>
    </div>
  </div>
);

// Section wrapper
const Section = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-border/15 bg-card/20 backdrop-blur-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

const SectionHeader = ({ icon: Icon, title, subtitle, actions }: { icon: any; title: string; subtitle?: string; actions?: React.ReactNode }) => (
  <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 bg-muted/5">
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <div>
        <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
    {actions}
  </div>
);

const SearchBar = ({ value, onChange, placeholder, onRefresh }: { value: string; onChange: (v: string) => void; placeholder: string; onRefresh: () => void }) => (
  <div className="flex gap-3 px-6 py-4">
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pl-10 bg-background/50 border-border/20 h-10 text-sm"
      />
    </div>
    <Button onClick={onRefresh} variant="outline" size="icon" className="h-10 w-10 border-border/20 hover:bg-muted/30">
      <RefreshCw className="h-4 w-4" />
    </Button>
  </div>
);

const EmptyState = ({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6">
    <div className="w-16 h-16 rounded-2xl bg-muted/10 flex items-center justify-center mb-4">
      <Icon className="h-8 w-8 text-muted-foreground/30" />
    </div>
    <p className="text-sm font-medium text-muted-foreground/60">{title}</p>
    <p className="text-xs text-muted-foreground/40 mt-1">{subtitle}</p>
  </div>
);

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
  const [newBanType, setNewBanType] = useState("ip");
  const [newBanValue, setNewBanValue] = useState("");
  const [newBanReason, setNewBanReason] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (!session) { navigate("/auth"); return; }
      setCurrentUserId(session.user.id);
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

  const fetchUsers = async () => { setLoading(true); try { const data = await adminCall('list_users'); setUsers(data.users || []); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } finally { setLoading(false); } };
  const fetchPastes = async () => { try { const data = await adminCall('list_pastes'); setPastes(data.pastes || []); } catch (e: any) { console.error(e); } };
  const fetchAccessLogs = async () => { setDbLoading(true); try { const data = await adminCall('list_access_logs'); setAccessLogs(data.logs || []); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } finally { setDbLoading(false); } };
  const fetchSessions = async () => { setDbLoading(true); try { const data = await adminCall('list_sessions'); setSessions(data.sessions || []); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } finally { setDbLoading(false); } };
  const fetchActivity = async () => { setDbLoading(true); try { const data = await adminCall('list_activity'); setActivity(data.activity || []); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } finally { setDbLoading(false); } };
  const fetchReviews = async () => { setDbLoading(true); try { const data = await adminCall('list_reviews'); setReviews(data.reviews || []); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } finally { setDbLoading(false); } };
  const fetchGlobalBans = async () => { try { const data = await adminCall('list_global_bans'); setGlobalBans(data.bans || []); } catch (e: any) { console.error(e); } };
  const fetchThreats = async () => { try { const data = await adminCall('list_threats'); setThreats(data.threats || []); } catch (e: any) { console.error(e); } };

  // Derive banned users/IPs directly from globalBans state
  const bannedUsers = globalBans.filter(b => b.is_active && (b.ban_type === 'roblox_id' || b.ban_type === 'discord_id')).map(b => ({
    roblox_user_id: b.ban_type === 'roblox_id' ? b.ban_value : null,
    roblox_username: null, roblox_display_name: null, roblox_avatar_url: null,
    roblox_created_at: null, roblox_is_banned: null,
    discord_user_id: b.ban_type === 'discord_id' ? b.ban_value : null,
    discord_username: null, discord_avatar: null, discord_created_at: null,
    ip_address: null, last_seen_at: null,
    ban_reason: b.reason || 'Global ban', banned_at: b.banned_at,
  }));
  const bannedIps = globalBans.filter(b => b.is_active && (b.ban_type === 'ip' || b.ban_type === 'subnet')).map(b => ({
    ip_address: b.ban_value,
    roblox_user_id: null, roblox_username: null, roblox_avatar_url: null,
    discord_user_id: null, discord_username: null, discord_avatar: null, discord_created_at: null,
    last_seen_at: null, ban_reason: b.reason || 'Global ban', banned_at: b.banned_at, access_type: null,
  }));

  const handleClearAllThreats = async () => {
    if (!confirm('Clear all threat logs? This cannot be undone.')) return;
    try {
      await adminCall('clear_threats');
      setThreats([]);
      toast({ title: "All threats cleared" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };
  const handleClearAllLogs = async () => {
    if (!confirm('Clear all access logs? This cannot be undone.')) return;
    try {
      await adminCall('clear_access_logs');
      setAccessLogs([]);
      toast({ title: "All access logs cleared" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };
  const handleClearAllSessions = async () => {
    if (!confirm('Clear all sessions? This cannot be undone.')) return;
    try {
      await adminCall('clear_sessions');
      setSessions([]);
      toast({ title: "All sessions cleared" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };
  const handleClearAllActivity = async () => {
    if (!confirm('Clear all activity logs? This cannot be undone.')) return;
    try {
      await adminCall('clear_activity');
      setActivity([]);
      toast({ title: "All activity cleared" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const handleDeleteUser = async (userId: string) => { if (!confirm('Permanently delete this user and all their data?')) return; try { await adminCall('delete_user', { target_user_id: userId }); toast({ title: "User Deleted" }); fetchUsers(); fetchPastes(); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } };
  const handleBanUser = async (userId: string) => { if (!banReason.trim()) { toast({ title: "Error", description: "Provide a ban reason", variant: "destructive" }); return; } try { await adminCall('ban_user', { target_user_id: userId, reason: banReason }); toast({ title: "User Banned" }); setBanReason(""); setSelectedUserId(null); fetchUsers(); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } };
  const handleUnbanUser = async (userId: string) => { try { await adminCall('unban_user', { target_user_id: userId }); toast({ title: "User Unbanned" }); fetchUsers(); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } };
  const handleDeletePaste = async (pasteId: string) => { if (!confirm('Delete this paste permanently?')) return; try { await adminCall('delete_paste', { paste_id: pasteId }); toast({ title: "Paste Deleted" }); fetchPastes(); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } };
  const handleDeleteReview = async (reviewId: string) => { try { await adminCall('delete_review', { review_id: reviewId }); setReviews(prev => prev.filter(r => r.id !== reviewId)); toast({ title: "Review Deleted" }); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } };
  const handleAddGlobalBan = async () => { if (!newBanValue.trim()) { toast({ title: "Error", description: "Provide a value to ban", variant: "destructive" }); return; } try { await adminCall('add_global_ban', { ban_type: newBanType, ban_value: newBanValue, reason: newBanReason }); toast({ title: "Global Ban Added", description: `${newBanType}: ${newBanValue}` }); setNewBanValue(""); setNewBanReason(""); fetchGlobalBans(); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } };
  const handleRemoveGlobalBan = async (banId: string) => { try { await adminCall('remove_global_ban', { ban_id: banId }); toast({ title: "Ban Removed" }); fetchGlobalBans(); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } };
  const handleResolveThreat = async (threatId: string) => { try { await adminCall('resolve_threat', { threat_id: threatId }); toast({ title: "Threat Resolved" }); fetchThreats(); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } };
  const handleAutoBanThreat = async (threat: ThreatEntry) => { try { if (threat.source_ip) await adminCall('add_global_ban', { ban_type: 'ip', ban_value: threat.source_ip, reason: `Auto-ban: ${threat.threat_type}` }); if (threat.roblox_user_id) await adminCall('add_global_ban', { ban_type: 'roblox_id', ban_value: threat.roblox_user_id, reason: `Auto-ban: ${threat.threat_type}` }); if (threat.discord_user_id) await adminCall('add_global_ban', { ban_type: 'discord_id', ban_value: threat.discord_user_id, reason: `Auto-ban: ${threat.threat_type}` }); await adminCall('resolve_threat', { threat_id: threat.id, auto_banned: true }); toast({ title: "Threat Auto-Banned" }); fetchThreats(); fetchGlobalBans(); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } };

  const handleCopy = (content: string) => { navigator.clipboard.writeText(content); toast({ title: "Copied" }); };
  const handleDownloadPaste = (paste: AdminPaste) => { const blob = new Blob([paste.content], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${paste.title || paste.slug}.lua`; a.click(); URL.revokeObjectURL(url); };

  const filteredUsers = users.filter(u => u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || u.discord_username?.toLowerCase().includes(searchTerm.toLowerCase()) || u.ip_addresses.some(ip => ip.address.includes(searchTerm)));
  const filteredPastes = pastes.filter(p => (p.title || '').toLowerCase().includes(pasteSearch.toLowerCase()) || p.slug.toLowerCase().includes(pasteSearch.toLowerCase()) || p.owner_email.toLowerCase().includes(pasteSearch.toLowerCase()));
  const filteredLogs = accessLogs.filter(l => l.ip_address?.includes(logSearch) || l.roblox_username?.toLowerCase().includes(logSearch.toLowerCase()) || l.paste_slug?.includes(logSearch) || l.paste_owner_email?.toLowerCase().includes(logSearch.toLowerCase()));
  const filteredSessions = sessions.filter(s => s.user_email?.toLowerCase().includes(sessionSearch.toLowerCase()) || s.ip_address?.includes(sessionSearch));
  const filteredActivity = activity.filter(a => a.user_email?.toLowerCase().includes(activitySearch.toLowerCase()) || a.activity_type?.toLowerCase().includes(activitySearch.toLowerCase()));

  const unresolvedThreats = threats.filter(t => !t.resolved);
  const criticalThreats = unresolvedThreats.filter(t => t.severity === 'critical');
  const bannedCount = users.filter(u => u.is_banned).length;
  const activeBans = globalBans.filter(b => b.is_active).length;

  if (!authReady || !isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-muted/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary animate-pulse" />
          </div>
          <p className="text-xs text-muted-foreground tracking-widest uppercase">Authenticating...</p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/auth"); };

  const severityColor = (s: string) => s === 'critical' ? 'text-red-400 bg-red-400/10 border-red-400/20' : s === 'high' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' : 'text-muted-foreground bg-muted/10 border-border/20';
  const banTypeColor = (t: string) => t === 'ip' ? 'text-red-400 bg-red-400/10' : t === 'subnet' ? 'text-amber-400 bg-amber-400/10' : t === 'roblox_id' ? 'text-blue-400 bg-blue-400/10' : 'text-purple-400 bg-purple-400/10';

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/10 bg-background/60 backdrop-blur-2xl">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between h-14 px-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-wide">COMMAND CENTER</span>
              <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">v2.0</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground gap-2 text-xs">
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-8">
        {/* Hero section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground/40 text-xs">
            <Shield className="h-3 w-3" />
            <span>Admin</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground/70">Overview</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
          <p className="text-sm text-muted-foreground/60">Full site control · Threat detection · Global enforcement</p>
        </div>

        {/* Critical threat alert */}
        {criticalThreats.length > 0 && (
          <div className="flex items-center gap-4 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400 animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-400">{criticalThreats.length} Critical Threat{criticalThreats.length > 1 ? 's' : ''}</p>
              <p className="text-xs text-muted-foreground/60">Immediate review required in Threats tab</p>
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard icon={Users} label="Users" value={users.length} />
          <StatCard icon={FileCode} label="Pastes" value={pastes.length} />
          <StatCard icon={Ban} label="Banned" value={bannedCount} color="text-red-400" />
          <StatCard icon={Globe} label="Global Bans" value={activeBans} color="text-amber-400" />
          <StatCard icon={Crosshair} label="Threats" value={unresolvedThreats.length} color={unresolvedThreats.length > 0 ? "text-red-400" : "text-muted-foreground"} />
        </div>

        {/* Main tabs */}
        <Tabs defaultValue="threats" className="w-full">
          <div className="border-b border-border/10 -mx-6 px-6">
            <TabsList className="bg-transparent h-auto p-0 gap-0 rounded-none">
              {[
                
                { value: "threats", icon: Crosshair, label: "Threats", badge: unresolvedThreats.length || undefined },
                { value: "global-bans", icon: ShieldAlert, label: "Bans" },
                { value: "users", icon: Users, label: "Users" },
                { value: "pastes", icon: FileCode, label: "Pastes" },
                { value: "access-logs", icon: Database, label: "Logs", onClick: fetchAccessLogs },
                { value: "sessions", icon: Clock, label: "Sessions", onClick: fetchSessions },
                { value: "activity", icon: Activity, label: "Activity", onClick: fetchActivity },
                
                { value: "banned-users", icon: ShieldBan, label: "Banned Users" },
                { value: "banned-ips", icon: Globe, label: "Banned IPs" },
              ].map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  type="button"
                  onClick={tab.onClick}
                  className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-xs font-medium text-muted-foreground data-[state=active]:text-foreground transition-all"
                >
                  <tab.icon className="h-3.5 w-3.5 mr-1.5" />
                  {tab.label}
                  {tab.badge && tab.badge > 0 && (
                    <span className="ml-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold px-1">
                      {tab.badge}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>


          {/* ===== THREATS ===== */}
          <TabsContent value="threats" className="mt-6">
            <Section>
              <SectionHeader
                icon={Crosshair}
                title="Threat Detection"
                subtitle={`${unresolvedThreats.length} unresolved · ${threats.length} total`}
                actions={<div className="flex gap-2">{threats.length > 0 && <Button onClick={handleClearAllThreats} variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive"><Trash2 className="h-3 w-3 mr-1" />Clear All</Button>}<Button onClick={fetchThreats} variant="ghost" size="sm" className="text-xs text-muted-foreground"><RefreshCw className="h-3 w-3 mr-1" />Refresh</Button></div>}
              />
              {threats.length === 0 ? (
                <EmptyState icon={ShieldCheck} title="All Clear" subtitle="No threats have been detected" />
              ) : (
                <div className="divide-y divide-border/10">
                  {threats.map(threat => (
                    <div key={threat.id} className={`flex items-start justify-between gap-4 p-5 transition-colors ${threat.resolved ? 'opacity-40' : 'hover:bg-muted/5'}`}>
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${severityColor(threat.severity)}`}>
                            {threat.severity}
                          </span>
                          <span className="text-sm font-medium">{threat.threat_type.replace(/_/g, ' ')}</span>
                          {threat.resolved && <span className="text-[10px] text-green-400/60 font-medium">RESOLVED</span>}
                          {threat.auto_banned && <span className="text-[10px] text-red-400/60 font-medium">AUTO-BANNED</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground/60 font-mono">
                          {threat.source_ip && <span>IP: {threat.source_ip}</span>}
                          {threat.roblox_user_id && <span>RBLX: {threat.roblox_user_id}</span>}
                          {threat.discord_user_id && <span>DSC: {threat.discord_user_id}</span>}
                        </div>
                        <p className="text-[11px] text-muted-foreground/40">{new Date(threat.created_at).toLocaleString()}</p>
                      </div>
                      {!threat.resolved && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button size="sm" variant="ghost" onClick={() => handleResolveThreat(threat.id)} className="text-xs h-8 text-muted-foreground hover:text-green-400">
                            <ShieldCheck className="h-3.5 w-3.5 mr-1" />Resolve
                          </Button>
                          <Button size="sm" onClick={() => handleAutoBanThreat(threat)} className="text-xs h-8 bg-red-500/10 text-red-400 hover:bg-red-500/20 border-0">
                            <Skull className="h-3.5 w-3.5 mr-1" />Ban All
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </TabsContent>

          {/* ===== GLOBAL BANS ===== */}
          <TabsContent value="global-bans" className="mt-6 space-y-4">
            {/* Add ban form */}
            <Section>
              <SectionHeader icon={Ban} title="Add Global Ban" subtitle="Block IPs, subnets, Roblox IDs, or Discord IDs site-wide" />
              <div className="p-6 space-y-3">
                <div className="flex flex-wrap gap-3">
                  <select value={newBanType} onChange={e => setNewBanType(e.target.value)} className="bg-background/50 border border-border/20 rounded-lg px-3 py-2.5 text-sm min-w-[160px] focus:outline-none focus:ring-1 focus:ring-primary/30">
                    <option value="ip">IP Address</option>
                    <option value="subnet">Subnet</option>
                    <option value="roblox_id">Roblox User ID</option>
                    <option value="discord_id">Discord User ID</option>
                  </select>
                  <Input placeholder="Value to ban..." value={newBanValue} onChange={e => setNewBanValue(e.target.value)} className="flex-1 min-w-[200px] bg-background/50 border-border/20" />
                  <Input placeholder="Reason (optional)" value={newBanReason} onChange={e => setNewBanReason(e.target.value)} className="flex-1 min-w-[150px] bg-background/50 border-border/20" />
                  <Button onClick={handleAddGlobalBan} className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border-0 gap-2">
                    <Ban className="h-4 w-4" />Add Ban
                  </Button>
                </div>
              </div>
            </Section>

            {/* Active bans list */}
            <Section>
              <SectionHeader
                icon={ShieldAlert}
                title="Active Bans"
                subtitle={`${activeBans} enforced`}
                actions={<Button onClick={fetchGlobalBans} variant="ghost" size="sm" className="text-xs text-muted-foreground"><RefreshCw className="h-3 w-3" /></Button>}
              />
              {activeBans === 0 ? (
                <EmptyState icon={ShieldCheck} title="No Active Bans" subtitle="Add a global ban above" />
              ) : (
                <div className="divide-y divide-border/10">
                  {globalBans.filter(b => b.is_active).map(ban => (
                    <div key={ban.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/5 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${banTypeColor(ban.ban_type)}`}>
                          {ban.ban_type.replace('_', ' ')}
                        </span>
                        <span className="font-mono text-sm truncate">{ban.ban_value}</span>
                        {ban.reason && <span className="text-xs text-muted-foreground/40 truncate hidden sm:inline">— {ban.reason}</span>}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-[10px] text-muted-foreground/30 hidden sm:inline">{new Date(ban.banned_at).toLocaleDateString()}</span>
                        <Button size="sm" variant="ghost" onClick={() => handleRemoveGlobalBan(ban.id)} className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-red-400">
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </TabsContent>

          {/* ===== USERS ===== */}
          <TabsContent value="users" className="mt-6">
            <Section>
              <SectionHeader icon={Users} title="User Management" subtitle={`${filteredUsers.length} users`} />
              <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search by email, Discord, or IP..." onRefresh={fetchUsers} />
              {loading ? (
                <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
              ) : (
                <div className="divide-y divide-border/10">
                  {filteredUsers.map(user => (
                    <div key={user.id} className={`flex items-start justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/5 ${user.is_banned ? 'bg-red-500/3' : ''}`}>
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{user.email}</p>
                          {user.is_banned && (
                            <span className="text-[10px] font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-md">BANNED</span>
                          )}
                        </div>
                        {user.discord_username && <p className="text-xs text-muted-foreground/50">Discord: {user.discord_username}</p>}
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/40">
                          <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
                          <span>·</span>
                          <span>Last {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground/25 font-mono">{user.id}</p>
                        {user.ip_addresses.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {user.ip_addresses.map((ip, idx) => (
                              <span key={idx} onClick={() => handleCopy(ip.address)} className={`text-[11px] font-mono px-2 py-0.5 rounded-md cursor-pointer transition-colors ${ip.is_primary ? 'bg-primary/10 text-primary/70 hover:bg-primary/20' : 'bg-muted/10 text-muted-foreground/40 hover:bg-muted/20'}`}>
                                {ip.address}{ip.is_primary ? ' ★' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        {user.ban_reason && <p className="text-[11px] text-red-400/60 mt-1">Reason: {user.ban_reason}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {user.is_banned ? (
                          <Button size="sm" variant="ghost" onClick={() => handleUnbanUser(user.id)} className="text-xs h-8 text-muted-foreground hover:text-green-400">
                            <Unlock className="h-3.5 w-3.5 mr-1" />Unban
                          </Button>
                        ) : (
                          selectedUserId === user.id ? (
                            <div className="flex items-center gap-2">
                              <Input placeholder="Reason..." value={banReason} onChange={e => setBanReason(e.target.value)} className="text-xs h-8 w-28 bg-background/50 border-border/20" />
                              <Button size="sm" onClick={() => handleBanUser(user.id)} className="text-xs h-8 bg-red-500/10 text-red-400 hover:bg-red-500/20 border-0">Ban</Button>
                              <Button size="sm" variant="ghost" onClick={() => { setSelectedUserId(null); setBanReason(""); }} className="text-xs h-8">✕</Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => setSelectedUserId(user.id)} className="text-xs h-8 text-muted-foreground hover:text-amber-400">
                              <Ban className="h-3.5 w-3.5 mr-1" />Ban
                            </Button>
                          )
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(user.id)} className="text-xs h-8 text-muted-foreground/40 hover:text-red-400">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </TabsContent>

          {/* ===== PASTES ===== */}
          <TabsContent value="pastes" className="mt-6">
            <Section>
              <SectionHeader icon={FileCode} title="Paste Management" subtitle={`${filteredPastes.length} pastes`} />
              <SearchBar value={pasteSearch} onChange={setPasteSearch} placeholder="Search by title, slug, or owner..." onRefresh={fetchPastes} />
              <div className="divide-y divide-border/10">
                {filteredPastes.map(paste => (
                  <div key={paste.id} className="px-6 py-4 hover:bg-muted/5 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{paste.title || paste.slug}</p>
                          {paste.protection_enabled ? (
                            <Lock className="h-3 w-3 text-green-400/60" />
                          ) : (
                            <Unlock className="h-3 w-3 text-muted-foreground/30" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/40">
                          <span className="font-mono">{paste.slug}</span>
                          <span>·</span>
                          <span>{paste.owner_email}</span>
                          <span>·</span>
                          <span>{new Date(paste.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => setExpandedPaste(expandedPaste === paste.id ? null : paste.id)} className="h-8 w-8 p-0 text-muted-foreground/40">
                          {expandedPaste === paste.id ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleCopy(paste.content)} className="h-8 w-8 p-0 text-muted-foreground/40"><Copy className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDownloadPaste(paste)} className="h-8 w-8 p-0 text-muted-foreground/40"><Download className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeletePaste(paste.id)} className="h-8 w-8 p-0 text-muted-foreground/40 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    {expandedPaste === paste.id && (
                      <pre className="mt-3 p-4 bg-background/50 rounded-lg text-xs max-h-48 overflow-auto font-mono text-muted-foreground/60 border border-border/10">{paste.content.substring(0, 2000)}</pre>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          </TabsContent>

          {/* ===== ACCESS LOGS ===== */}
          <TabsContent value="access-logs" className="mt-6">
            <Section>
              <SectionHeader icon={Database} title="Access Logs" subtitle={`${filteredLogs.length} entries`} />
              <SearchBar value={logSearch} onChange={setLogSearch} placeholder="Search by IP, Roblox user, paste..." onRefresh={fetchAccessLogs} />
              {dbLoading ? (
                <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
              ) : (
                <div className="divide-y divide-border/10">
                  {filteredLogs.slice(0, 100).map(log => (
                    <div key={log.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/5 transition-colors text-xs">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-foreground/70">{log.ip_address}</span>
                          <span className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${log.access_type === 'execution' ? 'text-green-400 bg-green-400/10' : 'text-muted-foreground bg-muted/10'}`}>
                            {log.access_type}
                          </span>
                          {log.is_active && <span className="h-1.5 w-1.5 rounded-full bg-green-400" />}
                        </div>
                        <p className="text-muted-foreground/40 truncate">
                          {log.roblox_username && `${log.roblox_username} · `}
                          {log.paste_slug} · {log.paste_owner_email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-muted-foreground/25 hidden sm:inline">{new Date(log.last_seen_at).toLocaleString()}</span>
                        <Button size="sm" variant="ghost" onClick={() => handleCopy(log.ip_address)} className="h-7 w-7 p-0 text-muted-foreground/30"><Copy className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { setNewBanType('ip'); setNewBanValue(log.ip_address); }} className="h-7 w-7 p-0 text-muted-foreground/30 hover:text-red-400"><Ban className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </TabsContent>

          {/* ===== SESSIONS ===== */}
          <TabsContent value="sessions" className="mt-6">
            <Section>
              <SectionHeader icon={Clock} title="Active Sessions" subtitle={`${filteredSessions.length} sessions`} />
              <SearchBar value={sessionSearch} onChange={setSessionSearch} placeholder="Search sessions..." onRefresh={fetchSessions} />
              {dbLoading ? (
                <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
              ) : (
                <div className="divide-y divide-border/10">
                  {filteredSessions.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/5 transition-colors">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{s.user_email}</p>
                        <p className="text-[11px] text-muted-foreground/40 font-mono">{s.ip_address || 'No IP'} · Last active {new Date(s.last_active).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </TabsContent>

          {/* ===== ACTIVITY ===== */}
          <TabsContent value="activity" className="mt-6">
            <Section>
              <SectionHeader icon={Activity} title="User Activity" subtitle={`${filteredActivity.length} events`} />
              <SearchBar value={activitySearch} onChange={setActivitySearch} placeholder="Search activity..." onRefresh={fetchActivity} />
              {dbLoading ? (
                <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
              ) : (
                <div className="divide-y divide-border/10">
                  {filteredActivity.slice(0, 100).map(a => (
                    <div key={a.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-medium">{a.user_email}</p>
                        <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted/10 text-muted-foreground/50">{a.activity_type}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground/30">{new Date(a.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </TabsContent>


          {/* ===== BANNED USERS ===== */}
          <TabsContent value="banned-users" className="mt-6">
            <BannedUsersTab users={bannedUsers} loading={loading} />
          </TabsContent>

          {/* ===== BANNED IPS ===== */}
          <TabsContent value="banned-ips" className="mt-6">
            <BannedIPsTab ips={bannedIps} loading={loading} />
          </TabsContent>
        </Tabs>
      </main>
      <JarvisVoice />
    </div>
  );
};

export default AdminDashboard;
