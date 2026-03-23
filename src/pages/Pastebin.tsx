import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import TabHelpSection from "@/components/onboarding/TabHelpSection";
import { pastebinHelp } from "@/components/onboarding/helpContent";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Copy, Upload, Trash2, Edit2, Check, X, Shield, Lock, Unlock, UserPlus, UserMinus, Clock, Globe, EyeOff, Terminal, Hand, ShieldBan, Key, Fingerprint, Zap, Bug, MapPin, Users, Webhook, Shuffle, Timer } from "lucide-react";
import HWIDManager from "@/components/HWIDManager";
import WhitelistTimeManager from "@/components/WhitelistTimeManager";
import CloudLogo from "@/components/CloudLogo";

interface Paste {
  id: string;
  title: string | null;
  content: string;
  slug: string;
  created_at: string;
  updated_at: string;
  protection_enabled: boolean;
  public_protection?: boolean;
  hide_code?: boolean;
  show_loading_bar?: boolean;
  show_welcome_message?: boolean;
  anti_fetch_enabled?: boolean;
  protection_mode?: string;
}

interface AccessEntry {
  id: string;
  paste_id: string;
  roblox_user_id: string;
  access_type: 'whitelist' | 'blacklist';
  expires_at: string | null;
  is_eternal: boolean;
  created_at: string;
}

const Pastebin = () => {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [rawUrl, setRawUrl] = useState("");
  const [pasteUrl, setPasteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [pastes, setPastes] = useState<Paste[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [consoleFeedbackMap, setConsoleFeedbackMap] = useState<Record<string, boolean>>({});
  
  // Access control state
  const [selectedPasteId, setSelectedPasteId] = useState<string>("");
  const [robloxUserId, setRobloxUserId] = useState("");
  const [accessEntries, setAccessEntries] = useState<AccessEntry[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [keyAssignedIds, setKeyAssignedIds] = useState<{ key_value: string; roblox_user_id: string | null }[]>([]);

  const generateSlug = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let slug = '';
    for (let i = 0; i < 8; i++) {
      slug += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return slug;
  };

  const getRawUrl = (slug: string) => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${baseUrl}/functions/v1/get-paste?slug=${slug}`;
  };

  const fetchPastes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('pastes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pastes:', error);
      return;
    }

    setPastes(data || []);
  };

  const fetchAccessEntries = async (pasteId: string) => {
    if (!pasteId) {
      setAccessEntries([]);
      return;
    }
    
    setLoadingAccess(true);
    const { data, error } = await supabase
      .from('paste_access_control')
      .select('*')
      .eq('paste_id', pasteId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching access entries:', error);
    } else {
      setAccessEntries((data || []) as AccessEntry[]);
    }
    setLoadingAccess(false);
  };

  useEffect(() => {
    fetchPastes();
  }, []);

  useEffect(() => {
    if (selectedPasteId) {
      fetchAccessEntries(selectedPasteId);
      fetchKeyAssignedIds(selectedPasteId);
    }
  }, [selectedPasteId]);

  const fetchKeyAssignedIds = async (pasteId: string) => {
    // Find control panel linked to this paste
    const { data: panel } = await supabase
      .from('control_panels')
      .select('id')
      .eq('paste_id', pasteId)
      .maybeSingle();

    if (!panel) {
      setKeyAssignedIds([]);
      return;
    }

    const { data: keys } = await supabase
      .from('control_panel_keys')
      .select('key_value, roblox_user_id')
      .eq('panel_id', panel.id)
      .not('roblox_user_id', 'is', null);

    setKeyAssignedIds((keys || []) as { key_value: string; roblox_user_id: string | null }[]);
  };

  const handleUpload = async () => {
    if (!content.trim()) {
      toast({ title: "Error", description: "Please enter some code", variant: "destructive" });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const slug = generateSlug();
      
      const { error } = await supabase
        .from('pastes')
        .insert({
          user_id: user.id,
          title: title.trim() || null,
          content: content,
          slug: slug,
          protection_enabled: false
        });

      if (error) throw error;

      const rawLink = getRawUrl(slug);
      setRawUrl(rawLink);
      setPasteUrl(rawLink);
      
      toast({ title: "Success!", description: "Paste created successfully" });
      setContent("");
      setTitle("");
      fetchPastes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, slug: string) => {
    if (!editContent.trim()) {
      toast({ title: "Error", description: "Content cannot be empty", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from('pastes')
        .update({ content: editContent })
        .eq('id', id);

      if (error) throw error;

      toast({ title: "Success!", description: "Paste updated - raw link unchanged" });
      setEditingId(null);
      setEditContent("");
      fetchPastes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('pastes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: "Deleted", description: "Paste removed successfully" });
      if (selectedPasteId === id) {
        setSelectedPasteId("");
        setAccessEntries([]);
      }
      fetchPastes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleProtection = async (pasteId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('pastes')
        .update({ protection_enabled: enabled })
        .eq('id', pasteId);

      if (error) throw error;

      toast({ 
        title: enabled ? "Protection Enabled" : "Protection Disabled",
        description: enabled 
          ? "Only whitelisted users can execute this script" 
          : "Anyone can execute this script"
      });
      fetchPastes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const togglePublicProtection = async (pasteId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('pastes')
        .update({ public_protection: enabled })
        .eq('id', pasteId);

      if (error) throw error;

      toast({ 
        title: enabled ? "Public Protection Enabled" : "Public Protection Disabled",
        description: enabled 
          ? "Anyone can execute (no whitelist needed), but blacklist still works" 
          : "Standard whitelist protection restored"
      });
      fetchPastes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleHideCode = async (pasteId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('pastes')
        .update({ hide_code: enabled })
        .eq('id', pasteId);

      if (error) throw error;

      toast({ 
        title: enabled ? "Hide Code Enabled" : "Hide Code Disabled",
        description: enabled 
          ? "Raw URL shows blank but loadstring execution still works" 
          : "Code is visible in raw URL again"
      });
      fetchPastes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleConsoleFeedback = async (pasteId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('pastes')
        .update({ show_loading_bar: enabled, show_welcome_message: enabled } as any)
        .eq('id', pasteId);

      if (error) throw error;

      setConsoleFeedbackMap(prev => ({ ...prev, [pasteId]: enabled }));
      toast({ 
        title: enabled ? "Console Feedback Enabled" : "Console Feedback Disabled",
        description: enabled 
          ? "Users will see an animated loading bar and welcome message in console" 
          : "Console feedback disabled"
      });
      fetchPastes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleAntiFetch = async (pasteId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('pastes')
        .update({ anti_fetch_enabled: enabled } as any)
        .eq('id', pasteId);

      if (error) throw error;

      toast({ 
        title: enabled ? "Anti-Fetch Enabled" : "Anti-Fetch Disabled",
        description: enabled 
          ? "setclipboard/raw fetch attempts will return 'Protected by ULT LUA'" 
          : "Anti-fetch protection disabled"
      });
      fetchPastes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const addAccessEntry = async (accessType: 'whitelist' | 'blacklist') => {
    if (!selectedPasteId) {
      toast({ title: "Error", description: "Please select a paste first", variant: "destructive" });
      return;
    }
    if (!robloxUserId.trim()) {
      toast({ title: "Error", description: "Please enter a Roblox User ID", variant: "destructive" });
      return;
    }
    if (!/^\d+$/.test(robloxUserId.trim())) {
      toast({ title: "Error", description: "Roblox User ID must be a number", variant: "destructive" });
      return;
    }

    try {
      await supabase
        .from('paste_access_control')
        .delete()
        .eq('paste_id', selectedPasteId)
        .eq('roblox_user_id', robloxUserId.trim());

      const { error } = await supabase
        .from('paste_access_control')
        .insert({
          paste_id: selectedPasteId,
          roblox_user_id: robloxUserId.trim(),
          access_type: accessType,
          is_eternal: false,
          expires_at: null
        });

      if (error) throw error;

      toast({ 
        title: "Added!",
        description: `User ${robloxUserId} added to ${accessType}`
      });
      setRobloxUserId("");
      fetchAccessEntries(selectedPasteId);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const removeAccessEntry = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('paste_access_control')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      toast({ title: "Removed", description: "Access entry removed" });
      fetchAccessEntries(selectedPasteId);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Link copied to clipboard" });
  };

  const startEditing = (paste: Paste) => {
    setEditingId(paste.id);
    setEditContent(paste.content);
  };

  const selectedPaste = pastes.find(p => p.id === selectedPasteId);
  const whitelistEntries = accessEntries.filter(e => e.access_type === 'whitelist');
  const blacklistEntries = accessEntries.filter(e => e.access_type === 'blacklist');

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/12 flex items-center justify-center">
            <CloudLogo size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Pastebin</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Upload and share your Lua scripts with raw links</p>
          </div>
        </div>

        <TabHelpSection {...pastebinHelp} />

        {/* Create New Paste */}
        <div className="rounded-xl border border-primary/10 bg-card/20 p-5 backdrop-blur-xl">
          <h2 className="text-sm font-semibold mb-4">Create New Paste</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs">Title (optional)</Label>
              <Input id="title" placeholder="My Script" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-background/50 h-9 text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="content" className="text-xs">Lua Code</Label>
              <Textarea id="content" placeholder="-- Paste your Lua code here..." value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[180px] font-mono text-xs bg-background/50" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Raw URL</Label>
                <div className="flex gap-1.5">
                  <Input readOnly value={rawUrl} placeholder="Upload to generate raw URL..." className="bg-muted/20 text-muted-foreground text-xs h-9" />
                  {rawUrl && (
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(rawUrl)} className="h-9 w-9 border-primary/10">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Paste URL</Label>
                <div className="flex gap-1.5">
                  <Input readOnly value={pasteUrl} placeholder="Upload to generate paste URL..." className="bg-muted/20 text-muted-foreground text-xs h-9" />
                  {pasteUrl && (
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(pasteUrl)} className="h-9 w-9 border-primary/10">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Button onClick={handleUpload} disabled={loading || !content.trim()} className="w-full h-9 text-xs rounded-lg">
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              {loading ? "Uploading..." : "Upload Paste"}
            </Button>
          </div>
        </div>

        {/* Script Protection Section with Tabs */}
        <div className={`rounded-xl border border-primary/10 bg-card/20 p-5 backdrop-blur-xl transition-opacity ${pastes.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-primary" />
            Script Protection
            {pastes.length === 0 && (
              <span className="text-[10px] text-muted-foreground font-normal ml-1">(Create a paste to unlock)</span>
            )}
          </h2>
          <div className="space-y-3">
            {/* Paste Selector */}
            <div className="space-y-2">
              <Label>Select Paste</Label>
              <Select value={selectedPasteId} onValueChange={setSelectedPasteId}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Choose a paste to manage..." />
                </SelectTrigger>
                <SelectContent>
                  {pastes.map((paste) => (
                    <SelectItem key={paste.id} value={paste.id}>
                      {paste.title || "Untitled"} - {paste.slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPaste && (
              <Tabs defaultValue="access" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="access">Access Control</TabsTrigger>
                  <TabsTrigger value="options">
                    <Shield className="h-4 w-4 mr-1" />
                    Options
                  </TabsTrigger>
                  <TabsTrigger value="advanced">
                    <Zap className="h-4 w-4 mr-1" />
                    Advanced
                    <Badge variant="outline" className="text-[8px] ml-1 px-1">NEW</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="time">
                    <Clock className="h-4 w-4 mr-1" />
                    Time
                  </TabsTrigger>
                  <TabsTrigger value="hwid">
                    <Fingerprint className="h-4 w-4 mr-1" />
                    HWID
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="access" className="space-y-4">
                  {/* Protection Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-background/30 border border-border/30">
                    <div className="flex items-center gap-2">
                      {selectedPaste.protection_enabled ? (
                        <Lock className="h-4 w-4 text-primary" />
                      ) : (
                        <Unlock className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm">
                        {selectedPaste.protection_enabled ? "Protection Enabled" : "Protection Disabled"}
                      </span>
                    </div>
                    <Switch
                      checked={selectedPaste.protection_enabled}
                      onCheckedChange={(checked) => toggleProtection(selectedPaste.id, checked)}
                    />
                  </div>

                  {/* User ID Input */}
                  <div className="space-y-2">
                    <Label>Roblox User ID</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter Roblox User ID (e.g., 123456789)"
                        value={robloxUserId}
                        onChange={(e) => setRobloxUserId(e.target.value)}
                        className="bg-background/50 flex-1"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => addAccessEntry('whitelist')}
                        className="shrink-0"
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Whitelist
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => addAccessEntry('blacklist')}
                        className="shrink-0 text-destructive border-destructive/50 hover:bg-destructive/10"
                      >
                        <UserMinus className="h-4 w-4 mr-1" />
                        Blacklist
                      </Button>
                    </div>
                  </div>

                  {/* Whitelist/Blacklist Display */}
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Whitelist */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1 text-primary">
                        <UserPlus className="h-4 w-4" />
                        Whitelist ({whitelistEntries.length})
                      </Label>
                      <div className="p-3 rounded-lg bg-background/30 border border-primary/20 min-h-[120px] max-h-[200px] overflow-y-auto">
                        {loadingAccess ? (
                          <p className="text-xs text-muted-foreground">Loading...</p>
                        ) : whitelistEntries.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No users whitelisted</p>
                        ) : (
                          <div className="space-y-1">
                            {whitelistEntries.map((entry) => (
                              <div key={entry.id} className="flex items-center justify-between text-sm bg-background/50 p-2 rounded">
                                <div className="flex flex-col">
                                  <span className="font-mono">{entry.roblox_user_id}</span>
                                  {entry.is_eternal && (
                                    <span className="text-xs text-primary">Eternal</span>
                                  )}
                                  {entry.expires_at && !entry.is_eternal && (
                                    <span className="text-xs text-muted-foreground">
                                      Expires: {new Date(entry.expires_at).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => removeAccessEntry(entry.id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Blacklist */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1 text-destructive">
                        <UserMinus className="h-4 w-4" />
                        Blacklist ({blacklistEntries.length})
                      </Label>
                      <div className="p-3 rounded-lg bg-background/30 border border-destructive/20 min-h-[120px] max-h-[200px] overflow-y-auto">
                        {loadingAccess ? (
                          <p className="text-xs text-muted-foreground">Loading...</p>
                        ) : blacklistEntries.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No users blacklisted</p>
                        ) : (
                          <div className="space-y-1">
                            {blacklistEntries.map((entry) => (
                              <div key={entry.id} className="flex items-center justify-between text-sm bg-background/50 p-2 rounded">
                                <span className="font-mono">{entry.roblox_user_id}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => removeAccessEntry(entry.id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Key System Assigned IDs */}
                    {keyAssignedIds.length > 0 && (
                      <div className="space-y-2 md:col-span-2">
                        <Label className="flex items-center gap-1 text-primary">
                          <Key className="h-4 w-4" />
                          Key Assigned IDs ({keyAssignedIds.length})
                        </Label>
                        <div className="p-3 rounded-lg bg-background/30 border border-primary/20 min-h-[80px] max-h-[200px] overflow-y-auto">
                          <div className="space-y-1">
                            {keyAssignedIds.map((entry, i) => (
                              <div key={i} className="flex items-center justify-between text-sm bg-background/50 p-2 rounded">
                                <span className="font-mono text-xs">{entry.roblox_user_id}</span>
                                <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">{entry.key_value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="options" className="space-y-4">
                  {/* Anti-Fetch */}
                  <div className="p-4 rounded-lg bg-background/30 border border-border/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShieldBan className="h-5 w-5 text-primary" />
                        <div>
                          <h4 className="font-medium flex items-center gap-2">
                            Anti-Fetch
                            <Badge variant="outline" className="text-[10px]">NEW</Badge>
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Block setclipboard/raw fetch attempts
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={(selectedPaste as any)?.anti_fetch_enabled || false}
                        onCheckedChange={(checked) => toggleAntiFetch(selectedPaste!.id, checked)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                      When enabled, setclipboard(game:HttpGet("url")) and raw fetch attempts will return 
                      "Protected by ULT LUA" instead of the real code. Overrides key system too.
                      Execution via loadstring() still works normally.
                    </p>
                  </div>

                  {/* Hide Code */}
                  <div className="p-4 rounded-lg bg-background/30 border border-border/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <EyeOff className="h-5 w-5 text-primary" />
                        <div>
                          <h4 className="font-medium flex items-center gap-2">
                            Hide Code
                            <Badge variant="outline" className="text-[10px]">NEW</Badge>
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Raw URL shows blank but loadstring execution works
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={selectedPaste.hide_code || false}
                        onCheckedChange={(checked) => toggleHideCode(selectedPaste.id, checked)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                      When enabled, visiting the raw URL in a browser shows nothing (blank page). 
                      But when executed via loadstring in Roblox, the script loads normally.
                      Everything works the same way - just the code is hidden from view.
                    </p>
                  </div>

                  {/* Public Protection */}
                  <div className="p-4 rounded-lg bg-background/30 border border-border/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-primary" />
                        <div>
                          <h4 className="font-medium">
                            Protection Without Whitelist
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Free-for-all with encryption, blacklist still works
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={selectedPaste.public_protection || false}
                        onCheckedChange={(checked) => togglePublicProtection(selectedPaste.id, checked)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                      When enabled, anyone can execute the script without being whitelisted. 
                      The script is still encrypted and blacklisted users are still blocked.
                    </p>
                  </div>

                  {/* Console Feedback (combined) */}
                  <div className="p-4 rounded-lg bg-background/30 border border-border/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Terminal className="h-5 w-5 text-primary" />
                        <div>
                          <h4 className="font-medium flex items-center gap-2">
                            Console Feedback
                            <Badge variant="outline" className="text-[10px]">NEW</Badge>
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Animated loading bar + welcome message in Roblox console
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={
                          consoleFeedbackMap[selectedPaste.id] !== undefined 
                            ? consoleFeedbackMap[selectedPaste.id] 
                            : ((selectedPaste as any).show_loading_bar !== false)
                        }
                        onCheckedChange={(checked) => toggleConsoleFeedback(selectedPaste.id, checked)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                      When enabled, users see an animated verification progress bar in the Roblox 
                      console with real-time status updates. After successful verification, a 
                      personalized welcome message greets the user by their Roblox display name.
                      Works with all protection modes.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="advanced" className="space-y-4">
                  {/* 1. Execution Limit */}
                  <div className="p-4 rounded-lg bg-background/30 border border-border/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Zap className="h-5 w-5 text-primary" />
                        <div>
                          <h4 className="font-medium flex items-center gap-2">
                            Execution Limit
                            <Badge variant="outline" className="text-[10px]">NEW</Badge>
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Cap how many times a user can run per day/hour
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={(selectedPaste as any)?.execution_limit_enabled || false}
                        onCheckedChange={async (checked) => {
                          await supabase.from('pastes').update({ execution_limit_enabled: checked } as any).eq('id', selectedPaste!.id);
                          fetchPastes();
                        }}
                      />
                    </div>
                    {(selectedPaste as any)?.execution_limit_enabled && (
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Max executions</Label>
                          <Input type="number" min="1" max="1000" 
                            defaultValue={(selectedPaste as any)?.execution_limit_per_user || 10}
                            onBlur={async (e) => {
                              await supabase.from('pastes').update({ execution_limit_per_user: parseInt(e.target.value) || 10 } as any).eq('id', selectedPaste!.id);
                              fetchPastes();
                            }}
                            className="bg-background/50"
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Per window</Label>
                          <Select defaultValue={(selectedPaste as any)?.execution_limit_window || 'daily'}
                            onValueChange={async (v) => {
                              await supabase.from('pastes').update({ execution_limit_window: v } as any).eq('id', selectedPaste!.id);
                              fetchPastes();
                            }}>
                            <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hourly">Hourly</SelectItem>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Crash Detection */}
                  <div className="p-4 rounded-lg bg-background/30 border border-border/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Bug className="h-5 w-5 text-primary" />
                        <div>
                          <h4 className="font-medium flex items-center gap-2">
                            Crash Detection
                            <Badge variant="outline" className="text-[10px]">NEW</Badge>
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Self-destructs if someone decompiles or hooks loadstring
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={(selectedPaste as any)?.crash_detection_enabled || false}
                        onCheckedChange={async (checked) => {
                          await supabase.from('pastes').update({ crash_detection_enabled: checked } as any).eq('id', selectedPaste!.id);
                          fetchPastes();
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                      Injects anti-decompile traps that corrupt the execution environment if someone tries to 
                      reverse-engineer or step through your code with a debugger.
                    </p>
                  </div>

                  {/* 3. Geo-Blocking */}
                  <div className="p-4 rounded-lg bg-background/30 border border-border/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-primary" />
                        <div>
                          <h4 className="font-medium flex items-center gap-2">
                            Geo-Blocking
                            <Badge variant="outline" className="text-[10px]">NEW</Badge>
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Block execution from specific countries
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={(selectedPaste as any)?.geo_blocking_enabled || false}
                        onCheckedChange={async (checked) => {
                          await supabase.from('pastes').update({ geo_blocking_enabled: checked } as any).eq('id', selectedPaste!.id);
                          fetchPastes();
                        }}
                      />
                    </div>
                    {(selectedPaste as any)?.geo_blocking_enabled && (
                      <div className="space-y-2">
                        <Label className="text-xs">Blocked country codes (comma separated, e.g. RU,CN,IR)</Label>
                        <Input
                          defaultValue={((selectedPaste as any)?.geo_blocked_countries || []).join(',')}
                          placeholder="RU,CN,IR,KP"
                          onBlur={async (e) => {
                            const countries = e.target.value.split(',').map((c: string) => c.trim().toUpperCase()).filter(Boolean);
                            await supabase.from('pastes').update({ geo_blocked_countries: countries } as any).eq('id', selectedPaste!.id);
                            fetchPastes();
                          }}
                          className="bg-background/50"
                        />
                      </div>
                    )}
                  </div>

                  {/* 4. Multi-Account Detection */}
                  <div className="p-4 rounded-lg bg-background/30 border border-border/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-primary" />
                        <div>
                          <h4 className="font-medium flex items-center gap-2">
                            Multi-Account Detection
                            <Badge variant="outline" className="text-[10px]">NEW</Badge>
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Flags/blocks if same HWID uses multiple Roblox accounts
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={(selectedPaste as any)?.multi_account_detection || false}
                        onCheckedChange={async (checked) => {
                          await supabase.from('pastes').update({ multi_account_detection: checked } as any).eq('id', selectedPaste!.id);
                          fetchPastes();
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                      Detects when the same hardware tries to use your script with different Roblox accounts.
                      Auto-blocks after 3+ accounts. Requires HWID Lock to be enabled.
                    </p>
                  </div>

                  {/* 5. Webhook Alerts */}
                  <div className="p-4 rounded-lg bg-background/30 border border-border/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Webhook className="h-5 w-5 text-primary" />
                        <div>
                          <h4 className="font-medium flex items-center gap-2">
                            Webhook Alerts
                            <Badge variant="outline" className="text-[10px]">NEW</Badge>
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Discord notifications when someone runs your script
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={(selectedPaste as any)?.webhook_alerts_enabled || false}
                        onCheckedChange={async (checked) => {
                          await supabase.from('pastes').update({ webhook_alerts_enabled: checked } as any).eq('id', selectedPaste!.id);
                          fetchPastes();
                        }}
                      />
                    </div>
                    {(selectedPaste as any)?.webhook_alerts_enabled && (
                      <div className="space-y-2">
                        <Label className="text-xs">Discord Webhook URL</Label>
                        <Input
                          type="url"
                          defaultValue={(selectedPaste as any)?.webhook_url || ''}
                          placeholder="https://discord.com/api/webhooks/..."
                          onBlur={async (e) => {
                            await supabase.from('pastes').update({ webhook_url: e.target.value.trim() || null } as any).eq('id', selectedPaste!.id);
                            fetchPastes();
                            toast({ title: "Webhook saved" });
                          }}
                          className="bg-background/50"
                        />
                      </div>
                    )}
                  </div>

                  {/* 6. Obfuscation on Delivery */}
                  <div className="p-4 rounded-lg bg-background/30 border border-border/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Shuffle className="h-5 w-5 text-primary" />
                        <div>
                          <h4 className="font-medium flex items-center gap-2">
                            Re-Obfuscation on Delivery
                            <Badge variant="outline" className="text-[10px]">NEW</Badge>
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Unique obfuscated version for every execution
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={(selectedPaste as any)?.obfuscation_on_delivery || false}
                        onCheckedChange={async (checked) => {
                          await supabase.from('pastes').update({ obfuscation_on_delivery: checked } as any).eq('id', selectedPaste!.id);
                          fetchPastes();
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                      Each user gets a structurally different version of your script every time they execute it. 
                      No two copies are the same — makes it impossible to diff or share.
                    </p>
                  </div>

                  {/* 7. Time Bomb */}
                  <div className="p-4 rounded-lg bg-background/30 border border-border/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Timer className="h-5 w-5 text-primary" />
                        <div>
                          <h4 className="font-medium flex items-center gap-2">
                            Time Bomb
                            <Badge variant="outline" className="text-[10px]">NEW</Badge>
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Script auto-expires after a set date
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={(selectedPaste as any)?.time_bomb_enabled || false}
                        onCheckedChange={async (checked) => {
                          const update: any = { time_bomb_enabled: checked };
                          if (checked && !(selectedPaste as any)?.time_bomb_expires_at) {
                            // Default to 7 days from now
                            update.time_bomb_expires_at = new Date(Date.now() + 7 * 86400000).toISOString();
                          }
                          await supabase.from('pastes').update(update).eq('id', selectedPaste!.id);
                          fetchPastes();
                        }}
                      />
                    </div>
                    {(selectedPaste as any)?.time_bomb_enabled && (
                      <div className="space-y-2">
                        <Label className="text-xs">Expiry date</Label>
                        <Input
                          type="datetime-local"
                          defaultValue={(selectedPaste as any)?.time_bomb_expires_at ? new Date((selectedPaste as any).time_bomb_expires_at).toISOString().slice(0, 16) : ''}
                          onChange={async (e) => {
                            if (e.target.value) {
                              await supabase.from('pastes').update({ time_bomb_expires_at: new Date(e.target.value).toISOString() } as any).eq('id', selectedPaste!.id);
                              fetchPastes();
                            }
                          }}
                          className="bg-background/50"
                        />
                        {(selectedPaste as any)?.time_bomb_expires_at && (
                          <p className="text-xs text-muted-foreground">
                            {new Date((selectedPaste as any).time_bomb_expires_at) > new Date() 
                              ? `Expires: ${new Date((selectedPaste as any).time_bomb_expires_at).toLocaleString()}`
                              : '⚠️ This script has expired!'
                            }
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="time">
                  <WhitelistTimeManager 
                    pasteId={selectedPasteId} 
                    onUpdate={() => fetchAccessEntries(selectedPasteId)} 
                  />
                </TabsContent>

                <TabsContent value="hwid" className="space-y-4">
                  {/* Protection Mode Selector */}
                  <div className="p-4 rounded-lg bg-background/30 border border-border/30 space-y-3">
                    <div className="flex items-center gap-3">
                      <Fingerprint className="h-5 w-5 text-primary" />
                      <div>
                        <h4 className="font-medium">Protection Mode</h4>
                        <p className="text-xs text-muted-foreground">
                          Choose how users are verified before executing your script
                        </p>
                      </div>
                    </div>
                    <Select 
                      value={(selectedPaste as any)?.protection_mode || 'whitelist'} 
                      onValueChange={async (value) => {
                        try {
                          const { error } = await supabase
                            .from('pastes')
                            .update({ protection_mode: value } as any)
                            .eq('id', selectedPaste!.id);
                          if (error) throw error;
                          toast({ 
                            title: "Protection Mode Updated",
                            description: value === 'whitelist' ? 'Using User ID whitelist only' 
                              : value === 'hwid' ? 'Using HWID locking (auto-binds on first run)' 
                              : 'Using both User ID whitelist + HWID locking'
                          });
                          fetchPastes();
                        } catch (error: any) {
                          toast({ title: "Error", description: error.message, variant: "destructive" });
                        }
                      }}
                    >
                      <SelectTrigger className="bg-background/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whitelist">
                          User ID Whitelist Only
                        </SelectItem>
                        <SelectItem value="hwid">
                          HWID Lock (binds to device on first run)
                        </SelectItem>
                        <SelectItem value="both">
                          Whitelist + HWID Lock (both required)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded space-y-1">
                      <p><strong>User ID Whitelist:</strong> Only whitelisted Roblox User IDs can execute.</p>
                      <p><strong>HWID Lock:</strong> Each whitelisted user's hardware is locked on first execution. Only that device can run the script.</p>
                      <p><strong>Both:</strong> User must be whitelisted AND running from their locked device.</p>
                    </div>
                  </div>

                  {/* HWID Manager */}
                  {((selectedPaste as any)?.protection_mode === 'hwid' || (selectedPaste as any)?.protection_mode === 'both') && (
                    <HWIDManager pasteId={selectedPasteId} />
                  )}

                  {(selectedPaste as any)?.protection_mode === 'whitelist' && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Switch to "HWID Lock" or "Both" mode to enable hardware-based protection.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>

        {/* Existing Pastes */}
        <div className="rounded-xl border border-primary/10 bg-card/20 p-5 backdrop-blur-xl">
          <h2 className="text-sm font-semibold mb-4">Your Pastes</h2>
            {pastes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No pastes yet. Create your first one above!
              </p>
            ) : (
              <div className="space-y-4">
                {pastes.map((paste) => (
                  <Card key={paste.id} className="border-border/30 bg-background/30">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium truncate">
                              {paste.title || "Untitled"}
                            </h3>
                            {paste.protection_enabled && (
                              <Lock className="h-3 w-3 text-primary" />
                            )}
                            {paste.public_protection && (
                              <Badge variant="outline" className="text-[10px]">PUBLIC</Badge>
                            )}
                            {paste.hide_code && (
                              <Badge variant="outline" className="text-[10px]">HIDDEN</Badge>
                            )}
                            {(paste as any).anti_fetch_enabled && (
                              <Badge variant="outline" className="text-[10px]">ANTI-FETCH</Badge>
                            )}
                            {(paste as any).execution_limit_enabled && (
                              <Badge variant="outline" className="text-[10px]">LIMIT</Badge>
                            )}
                            {(paste as any).crash_detection_enabled && (
                              <Badge variant="outline" className="text-[10px]">CRASH-DET</Badge>
                            )}
                            {(paste as any).geo_blocking_enabled && (
                              <Badge variant="outline" className="text-[10px]">GEO</Badge>
                            )}
                            {(paste as any).multi_account_detection && (
                              <Badge variant="outline" className="text-[10px]">MULTI-ACC</Badge>
                            )}
                            {(paste as any).webhook_alerts_enabled && (
                              <Badge variant="outline" className="text-[10px]">WEBHOOK</Badge>
                            )}
                            {(paste as any).obfuscation_on_delivery && (
                              <Badge variant="outline" className="text-[10px]">RE-OBFUSC</Badge>
                            )}
                            {(paste as any).time_bomb_enabled && (
                              <Badge variant="outline" className="text-[10px]">TIME-BOMB</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Created: {new Date(paste.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(getRawUrl(paste.slug))}
                            title="Copy Raw URL"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEditing(paste)}
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(paste.id)}
                            title="Delete"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-2">
                        <Input
                          readOnly
                          value={getRawUrl(paste.slug)}
                          className="text-xs bg-muted/30 text-muted-foreground"
                        />
                      </div>

                      {editingId === paste.id && (
                        <div className="mt-4 space-y-2">
                          <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="min-h-[150px] font-mono text-sm"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleUpdate(paste.id, paste.slug)}>
                              <Check className="mr-1 h-3 w-3" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(null);
                                setEditContent("");
                              }}
                            >
                              <X className="mr-1 h-3 w-3" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {editingId !== paste.id && (
                        <pre className="mt-2 p-2 bg-muted/20 rounded text-xs font-mono overflow-x-auto max-h-[100px] overflow-y-auto">
                          {paste.content.slice(0, 300)}
                          {paste.content.length > 300 && "..."}
                        </pre>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
    </DashboardLayout>
  );
};

export default Pastebin;
