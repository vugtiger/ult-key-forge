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
import { Copy, Upload, Trash2, Edit2, Check, X, Shield, Lock, Unlock, UserPlus, UserMinus, Clock, Globe, EyeOff } from "lucide-react";
import WhitelistTimeManager from "@/components/WhitelistTimeManager";
import luaLogo from "@/assets/lua-logo.png";

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
  
  // Access control state
  const [selectedPasteId, setSelectedPasteId] = useState<string>("");
  const [robloxUserId, setRobloxUserId] = useState("");
  const [accessEntries, setAccessEntries] = useState<AccessEntry[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(false);

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
    }
  }, [selectedPasteId]);

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

  const toggleLoadingBar = async (pasteId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('pastes')
        .update({ show_loading_bar: enabled } as any)
        .eq('id', pasteId);

      if (error) throw error;

      toast({ 
        title: enabled ? "Loading Bar Enabled" : "Loading Bar Disabled",
        description: enabled 
          ? "Users will see a verification loading bar in console" 
          : "Loading bar disabled"
      });
      fetchPastes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleWelcomeMessage = async (pasteId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('pastes')
        .update({ show_welcome_message: enabled } as any)
        .eq('id', pasteId);

      if (error) throw error;

      toast({ 
        title: enabled ? "Welcome Message Enabled" : "Welcome Message Disabled",
        description: enabled 
          ? "Users will see a welcome message with their username in console" 
          : "Welcome message disabled"
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <img src={luaLogo} alt="Lua Logo" className="h-12 w-12 object-contain" />
          <div>
            <h1 className="text-2xl font-bold">Pastebin</h1>
            <p className="text-muted-foreground">Upload and share your Lua scripts with raw links</p>
          </div>
        </div>

        <TabHelpSection {...pastebinHelp} />

        {/* Create New Paste */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Create New Paste</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                placeholder="My Script"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Lua Code</Label>
              <Textarea
                id="content"
                placeholder="-- Paste your Lua code here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[200px] font-mono text-sm bg-background/50"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Raw URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={rawUrl}
                    placeholder="Upload to generate raw URL..."
                    className="bg-muted/50 text-muted-foreground"
                  />
                  {rawUrl && (
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(rawUrl)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Paste URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={pasteUrl}
                    placeholder="Upload to generate paste URL..."
                    className="bg-muted/50 text-muted-foreground"
                  />
                  {pasteUrl && (
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(pasteUrl)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Button 
              onClick={handleUpload} 
              disabled={loading || !content.trim()}
              className="w-full cyber-glow"
            >
              <Upload className="mr-2 h-4 w-4" />
              {loading ? "Uploading..." : "Upload Paste"}
            </Button>
          </CardContent>
        </Card>

        {/* Script Protection Section with Tabs */}
        <Card className={`border-border/50 backdrop-blur-sm transition-opacity ${pastes.length === 0 ? 'opacity-50 pointer-events-none' : 'bg-card/50'}`}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Script Protection
              {pastes.length === 0 && (
                <span className="text-xs text-muted-foreground font-normal ml-2">(Create a paste to unlock)</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="access">Access Control</TabsTrigger>
                  <TabsTrigger value="options">
                    <Shield className="h-4 w-4 mr-1" />
                    Options
                  </TabsTrigger>
                  <TabsTrigger value="time">
                    <Clock className="h-4 w-4 mr-1" />
                    Whitelist Time
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
                      <Label className="flex items-center gap-1 text-green-400">
                        <UserPlus className="h-4 w-4" />
                        Whitelist ({whitelistEntries.length})
                      </Label>
                      <div className="p-3 rounded-lg bg-background/30 border border-green-500/20 min-h-[120px] max-h-[200px] overflow-y-auto">
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
                                    <span className="text-xs text-green-400">Eternal</span>
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
                      <Label className="flex items-center gap-1 text-red-400">
                        <UserMinus className="h-4 w-4" />
                        Blacklist ({blacklistEntries.length})
                      </Label>
                      <div className="p-3 rounded-lg bg-background/30 border border-red-500/20 min-h-[120px] max-h-[200px] overflow-y-auto">
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
                  </div>
                </TabsContent>

                <TabsContent value="options" className="space-y-4">
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
                </TabsContent>

                <TabsContent value="time">
                  <WhitelistTimeManager 
                    pasteId={selectedPasteId} 
                    onUpdate={() => fetchAccessEntries(selectedPasteId)} 
                  />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* Existing Pastes */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Your Pastes</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Pastebin;
