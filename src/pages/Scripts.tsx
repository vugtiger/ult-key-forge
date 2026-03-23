import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Download, Save, FileCode } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import TabHelpSection from "@/components/onboarding/TabHelpSection";
import { scriptStorageHelp } from "@/components/onboarding/helpContent";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

interface Script {
  id: string; name: string; description: string | null; script_content: string; created_at: string;
}

const Scripts = () => {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newScript, setNewScript] = useState({ name: "", description: "", content: "" });
  const { toast } = useToast();

  useEffect(() => { fetchScripts(); }, []);

  const fetchScripts = async () => {
    try {
      const { data, error } = await supabase.from('saved_scripts').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setScripts(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleSaveScript = async () => {
    if (!newScript.name || !newScript.content) {
      toast({ title: "Missing fields", description: "Name and content are required", variant: "destructive" });
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from('saved_scripts').insert({
        user_id: user.id, name: newScript.name, description: newScript.description || null, script_content: newScript.content,
      });
      if (error) throw error;
      toast({ title: "Success!", description: "Script saved successfully" });
      setNewScript({ name: "", description: "", content: "" });
      setDialogOpen(false);
      fetchScripts();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteScript = async (id: string) => {
    try {
      const { error } = await supabase.from('saved_scripts').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Script removed successfully" });
      fetchScripts();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDownloadScript = (script: Script) => {
    const blob = new Blob([script.script_content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.name.replace(/\s+/g, '_')}.lua`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/12 flex items-center justify-center">
              <Save className="text-primary" size={18} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Script Storage</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Save and manage your Roblox scripts securely</p>
            </div>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-lg gap-1.5 h-8 text-xs">
                <Plus size={14} /> New Script
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card/95 backdrop-blur-2xl border-primary/15 sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Script</DialogTitle>
                <DialogDescription>Save a new Roblox script to your storage</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="scriptName" className="text-xs">Script Name</Label>
                  <Input id="scriptName" placeholder="e.g., Auto Farm Script" value={newScript.name} onChange={(e) => setNewScript({ ...newScript, name: e.target.value })} className="bg-background/50 h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scriptDesc" className="text-xs">Description (Optional)</Label>
                  <Input id="scriptDesc" placeholder="What does this script do?" value={newScript.description} onChange={(e) => setNewScript({ ...newScript, description: e.target.value })} className="bg-background/50 h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scriptContent" className="text-xs">Script Content</Label>
                  <Textarea id="scriptContent" placeholder="Paste your Lua script here..." value={newScript.content} onChange={(e) => setNewScript({ ...newScript, content: e.target.value })} className="bg-background/50 min-h-[250px] font-mono text-xs" />
                </div>
                <Button onClick={handleSaveScript} className="w-full h-9 text-sm">Save Script</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <TabHelpSection {...scriptStorageHelp} />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : scripts.length === 0 ? (
          <div className="rounded-2xl border border-primary/10 bg-card/20 p-16 text-center backdrop-blur-xl">
            <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
              <FileCode className="text-primary/40" size={24} />
            </div>
            <p className="text-sm text-muted-foreground mb-4">No scripts saved yet</p>
            <Button onClick={() => setDialogOpen(true)} variant="outline" size="sm" className="rounded-lg text-xs h-8">
              Add Your First Script
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {scripts.map((script) => (
              <div key={script.id} className="group rounded-xl border border-primary/10 bg-card/20 p-4 backdrop-blur-xl transition-all duration-200 hover:border-primary/20 hover:shadow-[0_4px_20px_hsl(var(--primary)/0.08)]">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-sm font-semibold">{script.name}</h3>
                    {script.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{script.description}</p>
                    )}
                  </div>
                </div>

                <div className="bg-background/30 p-2.5 rounded-lg mb-3 font-mono text-[11px] text-muted-foreground overflow-hidden border border-primary/5">
                  <pre className="line-clamp-3">{script.script_content}</pre>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleDownloadScript(script)} className="flex-1 h-7 text-[11px] rounded-lg border-primary/10">
                    <Download size={12} className="mr-1" /> Download
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteScript(script.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                    <Trash2 size={13} />
                  </Button>
                </div>

                <p className="text-[10px] text-muted-foreground/50 mt-2">
                  Saved {new Date(script.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Scripts;
