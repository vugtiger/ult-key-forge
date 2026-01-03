import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Copy, Upload, Trash2, Edit2, Check, X, Lock, Unlock } from "lucide-react";

interface Paste {
  id: string;
  title: string | null;
  content: string;
  slug: string;
  created_at: string;
  updated_at: string;
  protection_enabled: boolean;
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

  useEffect(() => {
    fetchPastes();
  }, []);

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Link copied to clipboard" });
  };

  const startEditing = (paste: Paste) => {
    setEditingId(paste.id);
    setEditContent(paste.content);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Pastebin</h1>
          <p className="text-muted-foreground">Upload and share your Lua scripts with raw links</p>
        </div>

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
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium truncate">
                              {paste.title || "Untitled"}
                            </h3>
                            {paste.protection_enabled && (
                              <Lock className="h-3 w-3 text-primary" />
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

                      {/* Protection Toggle */}
                      <div className="flex items-center justify-between mt-3 p-2 rounded bg-background/30 border border-border/30">
                        <div className="flex items-center gap-2">
                          {paste.protection_enabled ? (
                            <Lock className="h-4 w-4 text-primary" />
                          ) : (
                            <Unlock className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm">
                            {paste.protection_enabled ? "Protection Enabled" : "Protection Disabled"}
                          </span>
                        </div>
                        <Switch
                          checked={paste.protection_enabled}
                          onCheckedChange={(checked) => toggleProtection(paste.id, checked)}
                        />
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
