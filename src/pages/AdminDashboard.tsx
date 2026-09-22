import { useState, useEffect, useRef } from "react";
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
  ChevronRight, Zap, Lock, Unlock, Bot, ShieldBan, Server
} from "lucide-react";
import JarvisVoice from "@/components/JarvisVoice";
import BannedUsersTab from "@/components/access-monitor/BannedUsersTab";
import BannedIPsTab from "@/components/access-monitor/BannedIPsTab";
import DiscordServersTab from "@/components/DiscordServersTab";
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
  <div className="relative min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-colors hover:border-primary/40">
    <div className="flex min-w-0 items-center gap-3 p-3 sm:p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold sm:text-2xl">{value}</p>
        <p className="break-words text-[11px] font-medium uppercase text-muted-foreground">{label}</p>
      </div>
    </div>
  </div>
);

// Section wrapper
const Section = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm ${className}`}>
    {children}
  </div>
);

const SectionHeader = ({ icon: Icon, title, subtitle, actions }: { icon: any; title: string; subtitle?: string; actions?: React.ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-3 border-b border-border bg-secondary/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
    <div className="flex min-w-0 items-center gap-3">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <div className="min-w-0">
        <h2 className="break-words text-sm font-semibold">{title}</h2>
        {subtitle && <p className="break-words text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

const SearchBar = ({ value, onChange, placeholder, onRefresh }: { value: string; onChange: (v: string) => void; placeholder: string; onRefresh: () => void }) => (
  <div className="flex gap-2 p-4 sm:px-5">
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pl-10 bg-background/50 border-border/20 h-10 text-sm"
      />
    </div>
    <Button aria-label="Refresh" onClick={onRefresh} variant="outline" size="icon" className="h-10 w-10 shrink-0">
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

interface BannedAccount {
  id: string; email: string; username: string | null;
  ban_reason: string | null; banned_at: string | null;
  discord_username: string | null; discord_user_id: string | null;
  is_banned: boolean;
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
  const [bannedAccounts, setBannedAccounts] = useState<BannedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbLoading, setDbLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pasteSearch, setPasteSearch] = useState("");
  const [pasteTotal, setPasteTotal] = useState(0);

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
  const [activeTab, setActiveTab] = useState("threats");
  const [bannedAccountSearch, setBannedAccountSearch] = useState("");
  const [showWelcome, setShowWelcome] = useState(true);
  const jarvisWelcomedRef = useRef(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // JARVIS welcome on first load
  useEffect(() => {
    if (authReady && isAdmin && !jarvisWelcomedRef.current) {
      jarvisWelcomedRef.current = true;
      const timer = setTimeout(() => {
        if (window.speechSynthesis) {
          const voices = window.speechSynthesis.getVoices();
          const preferred = voices.find(v => 
            v.name.includes("Daniel") || v.name.includes("Google UK English Male") || v.name.includes("Microsoft George")
          ) || voices.find(v => v.lang.startsWith("en"));
          
          const utterance = new SpeechSynthesisUtterance("Welcome back, sir. All systems are operational. Your command center is ready.");
          if (preferred) utterance.voice = preferred;
          utterance.rate = 0.92;
          utterance.pitch = 0.82;
          window.speechSynthesis.speak(utterance);
        }
      }, 1500);
      // Hide welcome overlay after animation
      const hideTimer = setTimeout(() => setShowWelcome(false), 3000);
      return () => { clearTimeout(timer); clearTimeout(hideTimer); };
    }
  }, [authReady, isAdmin]);

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
  const fetchPastes = async () => { try { const data = await adminCall('list_pastes', { limit: 200, search: pasteSearch || undefined }); setPastes(data.pastes || []); setPasteTotal(typeof data.total === 'number' ? data.total : (data.pastes || []).length); } catch (e: any) { toast({ title: "Could not load scripts", description: e.message, variant: "destructive" }); } };
  const loadPasteContent = async (pasteId: string): Promise<string> => {
    const existing = pastes.find(p => p.id === pasteId);
    if (existing?.content) return existing.content;
    const data = await adminCall('get_paste_content', { paste_id: pasteId });
    const content = data?.content || '';
    setPastes(prev => prev.map(p => (p.id === pasteId ? { ...p, content } : p)));
    return content;
  };

  const fetchAccessLogs = async () => { setDbLoading(true); try { const data = await adminCall('list_access_logs'); setAccessLogs(data.logs || []); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } finally { setDbLoading(false); } };
  const fetchSessions = async () => { setDbLoading(true); try { const data = await adminCall('list_sessions'); setSessions(data.sessions || []); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } finally { setDbLoading(false); } };
  const fetchActivity = async () => { setDbLoading(true); try { const data = await adminCall('list_activity'); setActivity(data.activity || []); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } finally { setDbLoading(false); } };
  const fetchReviews = async () => { setDbLoading(true); try { const data = await adminCall('list_reviews'); setReviews(data.reviews || []); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } finally { setDbLoading(false); } };
  const fetchGlobalBans = async () => { try { const data = await adminCall('list_global_bans'); setGlobalBans(data.bans || []); } catch (e: any) { console.error(e); } };
  const fetchThreats = async () => { try { const data = await adminCall('list_threats'); setThreats(data.threats || []); } catch (e: any) { console.error(e); } };
  const fetchBannedAccounts = async () => { setDbLoading(true); try { const data = await adminCall('list_banned_accounts'); setBannedAccounts(data.accounts || []); } catch (e: any) { console.error(e); } finally { setDbLoading(false); } };

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
  const handleAddGlobalBan = async () => { if (!newBanValue.trim()) { toast({ title: "Error", description: "Provide a value to ban", variant: "destructive" }); return; } try { const result = await adminCall('add_global_ban', { ban_type: newBanType, ban_value: newBanValue, reason: newBanReason }); const crossIps = result.cross_banned_ips || []; toast({ title: "Global Ban Added", description: crossIps.length > 0 ? `${newBanType}: ${newBanValue} + ${crossIps.length} associated IP${crossIps.length > 1 ? 's' : ''} banned` : `${newBanType}: ${newBanValue}` }); setNewBanValue(""); setNewBanReason(""); fetchGlobalBans(); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } };
  const handleRemoveGlobalBan = async (banId: string) => { try { await adminCall('remove_global_ban', { ban_id: banId }); toast({ title: "Ban Removed" }); fetchGlobalBans(); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } };
  const handleResolveThreat = async (threatId: string) => { try { await adminCall('resolve_threat', { threat_id: threatId }); toast({ title: "Threat Resolved" }); fetchThreats(); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } };
  const handleAutoBanThreat = async (threat: ThreatEntry) => { try { if (threat.source_ip) await adminCall('add_global_ban', { ban_type: 'ip', ban_value: threat.source_ip, reason: `Auto-ban: ${threat.threat_type}` }); if (threat.roblox_user_id) await adminCall('add_global_ban', { ban_type: 'roblox_id', ban_value: threat.roblox_user_id, reason: `Auto-ban: ${threat.threat_type}` }); if (threat.discord_user_id) await adminCall('add_global_ban', { ban_type: 'discord_id', ban_value: threat.discord_user_id, reason: `Auto-ban: ${threat.threat_type}` }); await adminCall('resolve_threat', { threat_id: threat.id, auto_banned: true }); toast({ title: "Threat Auto-Banned" }); fetchThreats(); fetchGlobalBans(); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } };

  const handleCopy = (content: string) => { navigator.clipboard.writeText(content); toast({ title: "Copied" }); };
  const handleDownloadPaste = async (paste: AdminPaste) => { try { const content = await loadPasteContent(paste.id); const blob = new Blob([content], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${paste.title || paste.slug}.lua`; a.click(); URL.revokeObjectURL(url); } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } };

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
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* JARVIS Welcome Overlay */}
      {showWelcome && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-xl animate-fade-in" 
             style={{ animation: 'fade-in 0.5s ease-out, fade-out 0.5s ease-out 2.5s forwards' }}>
          <div className="text-center animate-scale-in">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-spin" style={{ animationDuration: '3s' }} />
              <div className="absolute inset-2 rounded-full border border-primary/20 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
              <div className="absolute inset-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-8 w-8 text-primary/60" />
              </div>
            </div>
            <p className="text-xl font-bold tracking-[0.3em] text-primary/80 uppercase">J.A.R.V.I.S</p>
            <p className="text-sm text-muted-foreground/60 mt-2 tracking-wider">Welcome back, sir. All systems operational.</p>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-sm font-bold">ULT Owner</span>
              <span className="block text-[10px] text-muted-foreground">Command Center</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="h-auto max-w-[155px] shrink-0 gap-2 whitespace-normal px-3 py-2 text-center text-xs leading-4 sm:max-w-none"
          >
            <LogOut className="h-3.5 w-3.5 rotate-180" />
            <span>Back to Dashboard</span>
          </Button>

        </div>
      </header>

       <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-5 sm:px-6 sm:py-7">
        {/* Hero section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground/40 text-xs">
            <Shield className="h-3 w-3" />
            <span>Admin</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground/70">Overview</span>
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">Owner Dashboard</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">Manage protection, people, activity, and enforcement from one organized workspace.</p>
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard icon={Users} label="Users" value={users.length} />
          <StatCard icon={FileCode} label="Pastes" value={pastes.length} />
          <StatCard icon={Ban} label="Banned" value={bannedCount} color="text-red-400" />
          <StatCard icon={Globe} label="Global Bans" value={activeBans} color="text-amber-400" />
          <StatCard icon={Crosshair} label="Threats" value={unresolvedThreats.length} color={unresolvedThreats.length > 0 ? "text-red-400" : "text-muted-foreground"} />
        </div>

        {/* Main tabs */}
        <Tabs value={activeTab} onValueChange={(val) => {
          setActiveTab(val);
          // Auto-fetch data for lazy-loaded tabs
          if (val === 'access-logs' && accessLogs.length === 0) fetchAccessLogs();
          if (val === 'sessions' && sessions.length === 0) fetchSessions();
          if (val === 'activity' && activity.length === 0) fetchActivity();
          if (val === 'banned-accounts' && bannedAccounts.length === 0) fetchBannedAccounts();
        }} className="w-full lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-6">
          <aside className="min-w-0 lg:sticky lg:top-24">
            <div className="mb-2 hidden px-2 text-[11px] font-semibold uppercase text-muted-foreground lg:block">Workspace</div>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-lg border border-border bg-card p-2 shadow-sm sm:grid-cols-3 lg:grid-cols-1">
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
                { value: "banned-accounts", icon: Ban, label: "Banned Accounts", onClick: fetchBannedAccounts },
                { value: "discord-servers", icon: Server, label: "Servers" },
              ].map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  type="button"
                  onClick={tab.onClick}
                  className="min-h-11 min-w-0 justify-start whitespace-normal rounded-md border border-transparent px-3 py-2 text-left text-xs font-medium leading-4 text-muted-foreground transition-colors data-[state=active]:border-primary/20 data-[state=active]:bg-primary/10 data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                   <tab.icon className="mr-2 h-4 w-4 shrink-0" />
                   <span className="min-w-0 break-words">{tab.label}</span>
                  {tab.badge && tab.badge > 0 && (
                    <span className="ml-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold px-1">
                      {tab.badge}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </aside>
          <div className="min-w-0">


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
                    <div key={threat.id} className={`flex min-w-0 flex-col gap-4 p-4 transition-colors sm:flex-row sm:items-start sm:justify-between sm:p-5 ${threat.resolved ? 'opacity-40' : 'hover:bg-muted/5'}`}>
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
                        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-shrink-0">
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
              <div className="space-y-3 p-4 sm:p-5">
                <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <select value={newBanType} onChange={e => setNewBanType(e.target.value)} className="h-10 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30">
                    <option value="ip">IP Address</option>
                    <option value="subnet">Subnet</option>
                    <option value="roblox_id">Roblox User ID</option>
                    <option value="discord_id">Discord User ID</option>
                  </select>
                  <Input placeholder="Value to ban..." value={newBanValue} onChange={e => setNewBanValue(e.target.value)} className="min-w-0" />
                  <Input placeholder="Reason (optional)" value={newBanReason} onChange={e => setNewBanReason(e.target.value)} className="min-w-0" />
                  <Button onClick={handleAddGlobalBan} className="w-full gap-2 md:w-auto">
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
                    <div key={ban.id} className="flex min-w-0 items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/5 sm:px-5">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
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
                    <div key={user.id} className={`flex min-w-0 flex-col gap-4 p-4 transition-colors hover:bg-muted/5 sm:flex-row sm:items-start sm:justify-between sm:px-5 ${user.is_banned ? 'bg-destructive/5' : ''}`}>
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
                        <p className="break-all font-mono text-[10px] text-muted-foreground/50">{user.id}</p>
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
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-shrink-0">
                        {user.is_banned ? (
                          <Button size="sm" variant="ghost" onClick={() => handleUnbanUser(user.id)} className="text-xs h-8 text-muted-foreground hover:text-green-400">
                            <Unlock className="h-3.5 w-3.5 mr-1" />Unban
                          </Button>
                        ) : (
                          selectedUserId === user.id ? (
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-initial">
                              <Input placeholder="Reason..." value={banReason} onChange={e => setBanReason(e.target.value)} className="h-8 min-w-[130px] flex-1 text-xs sm:w-40 sm:flex-none" />
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
                  <div key={paste.id} className="p-4 transition-colors hover:bg-muted/5 sm:px-5">
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{paste.title || paste.slug}</p>
                          {paste.protection_enabled ? (
                            <Lock className="h-3 w-3 text-green-400/60" />
                          ) : (
                            <Unlock className="h-3 w-3 text-muted-foreground/30" />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="font-mono">{paste.slug}</span>
                          <span>·</span>
                          <span>{paste.owner_email}</span>
                          <span>·</span>
                          <span>{new Date(paste.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 self-end sm:flex-shrink-0 sm:self-auto">
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
              <SectionHeader icon={Database} title="Access Logs" subtitle={`${filteredLogs.length} entries`} actions={accessLogs.length > 0 ? <Button onClick={handleClearAllLogs} variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive"><Trash2 className="h-3 w-3 mr-1" />Clear All</Button> : undefined} />
              <SearchBar value={logSearch} onChange={setLogSearch} placeholder="Search by IP, Roblox user, paste..." onRefresh={fetchAccessLogs} />
              {dbLoading ? (
                <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
              ) : (
                <div className="divide-y divide-border/10">
                  {filteredLogs.slice(0, 100).map(log => (
                    <div key={log.id} className="flex min-w-0 items-center justify-between gap-3 p-4 text-xs transition-colors hover:bg-muted/5 sm:px-5">
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
              <SectionHeader icon={Clock} title="Active Sessions" subtitle={`${filteredSessions.length} sessions`} actions={sessions.length > 0 ? <Button onClick={handleClearAllSessions} variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive"><Trash2 className="h-3 w-3 mr-1" />Clear All</Button> : undefined} />
              <SearchBar value={sessionSearch} onChange={setSessionSearch} placeholder="Search sessions..." onRefresh={fetchSessions} />
              {dbLoading ? (
                <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
              ) : (
                <div className="divide-y divide-border/10">
                  {filteredSessions.map(s => (
                    <div key={s.id} className="min-w-0 p-4 transition-colors hover:bg-muted/5 sm:px-5">
                      <div className="min-w-0 space-y-1">
                        <p className="break-all text-sm font-medium">{s.user_email}</p>
                        <p className="break-words font-mono text-[11px] text-muted-foreground">{s.ip_address || 'No IP'} · Last active {new Date(s.last_active).toLocaleString()}</p>
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
              <SectionHeader icon={Activity} title="User Activity" subtitle={`${filteredActivity.length} events`} actions={activity.length > 0 ? <Button onClick={handleClearAllActivity} variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive"><Trash2 className="h-3 w-3 mr-1" />Clear All</Button> : undefined} />
              <SearchBar value={activitySearch} onChange={setActivitySearch} placeholder="Search activity..." onRefresh={fetchActivity} />
              {dbLoading ? (
                <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
              ) : (
                <div className="divide-y divide-border/10">
                  {filteredActivity.slice(0, 100).map(a => (
                    <div key={a.id} className="flex min-w-0 flex-col gap-2 p-4 transition-colors hover:bg-muted/5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                        <p className="break-all text-sm font-medium">{a.user_email}</p>
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

          {/* ===== BANNED ACCOUNTS ===== */}
          <TabsContent value="banned-accounts" className="mt-6">
            <Section>
              <SectionHeader
                icon={Ban}
                title="Banned Accounts"
                subtitle={`${bannedAccounts.length} banned accounts`}
                actions={<Button onClick={fetchBannedAccounts} variant="ghost" size="sm" className="text-xs text-muted-foreground"><RefreshCw className="h-3 w-3 mr-1" />Refresh</Button>}
              />
              <SearchBar value={bannedAccountSearch} onChange={setBannedAccountSearch} placeholder="Search banned accounts..." onRefresh={fetchBannedAccounts} />
              {dbLoading ? (
                <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
              ) : bannedAccounts.length === 0 ? (
                <EmptyState icon={ShieldCheck} title="No Banned Accounts" subtitle="No accounts are currently banned" />
              ) : (
                <div className="divide-y divide-border/10">
                  {bannedAccounts
                    .filter(a => a.email?.toLowerCase().includes(bannedAccountSearch.toLowerCase()) || a.username?.toLowerCase().includes(bannedAccountSearch.toLowerCase()) || a.ban_reason?.toLowerCase().includes(bannedAccountSearch.toLowerCase()))
                    .map(account => (
                    <div key={account.id} className="flex min-w-0 flex-col gap-4 p-4 transition-colors hover:bg-muted/5 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{account.email}</p>
                          <span className="text-[10px] font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-md">BANNED</span>
                        </div>
                        {account.username && <p className="text-xs text-muted-foreground/50">Username: {account.username}</p>}
                        {account.discord_username && <p className="text-xs text-muted-foreground/50">Discord: {account.discord_username}</p>}
                        {account.ban_reason && <p className="text-[11px] text-red-400/60 mt-1">Reason: {account.ban_reason}</p>}
                        {account.banned_at && <p className="text-[10px] text-muted-foreground/30">Banned: {new Date(account.banned_at).toLocaleString()}</p>}
                        <p className="break-all font-mono text-[10px] text-muted-foreground/50">{account.id}</p>
                      </div>
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-shrink-0">
                        <Button size="sm" variant="ghost" onClick={async () => {
                          try {
                            await adminCall('unban_user', { target_user_id: account.id });
                            toast({ title: "Account Unbanned", description: account.email });
                            setBannedAccounts(prev => prev.filter(a => a.id !== account.id));
                            fetchUsers();
                          } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
                        }} className="text-xs h-8 text-muted-foreground hover:text-green-400">
                          <Unlock className="h-3.5 w-3.5 mr-1" />Unban
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(account.id)} className="text-xs h-8 text-muted-foreground/40 hover:text-red-400">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </TabsContent>

          {/* ===== DISCORD SERVERS ===== */}
          <TabsContent value="discord-servers" className="mt-4 lg:mt-0">
            <Section>
              <DiscordServersTab />
            </Section>
          </TabsContent>
          </div>
        </Tabs>
      </main>
      <JarvisVoice onTabChange={setActiveTab} onRefreshData={() => {
        fetchUsers(); fetchPastes(); fetchGlobalBans(); fetchThreats(); fetchBannedAccounts();
      }} />
    </div>
  );
};

export default AdminDashboard;
