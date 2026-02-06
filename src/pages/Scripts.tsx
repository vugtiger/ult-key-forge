import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Download } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import TabHelpSection from "@/components/onboarding/TabHelpSection";
import { scriptStorageHelp } from "@/components/onboarding/helpContent";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Script {
  id: string;
  name: string;
  description: string | null;
  script_content: string;
  created_at: string;
}

const Scripts = () => {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newScript, setNewScript] = useState({
    name: "",
    description: "",
    content: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchScripts();
  }, []);

  const fetchScripts = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_scripts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setScripts(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveScript = async () => {
    if (!newScript.name || !newScript.content) {
      toast({
        title: "Missing fields",
        description: "Name and content are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from('saved_scripts').insert({
        user_id: user.id,
        name: newScript.name,
        description: newScript.description || null,
        script_content: newScript.content,
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Script saved successfully",
      });

      setNewScript({ name: "", description: "", content: "" });
      setDialogOpen(false);
      fetchScripts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteScript = async (id: string) => {
    try {
      const { error } = await supabase
        .from('saved_scripts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: "Script removed successfully",
      });

      fetchScripts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Script Storage</h1>
            <p className="text-muted-foreground">
              Save and manage your Roblox scripts securely
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="cyber-glow">
                <Plus className="mr-2" size={20} />
                New Script
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Script</DialogTitle>
                <DialogDescription>
                  Save a new Roblox script to your storage
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="scriptName">Script Name</Label>
                  <Input
                    id="scriptName"
                    placeholder="e.g., Auto Farm Script"
                    value={newScript.name}
                    onChange={(e) => setNewScript({ ...newScript, name: e.target.value })}
                    className="bg-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scriptDesc">Description (Optional)</Label>
                  <Input
                    id="scriptDesc"
                    placeholder="What does this script do?"
                    value={newScript.description}
                    onChange={(e) => setNewScript({ ...newScript, description: e.target.value })}
                    className="bg-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scriptContent">Script Content</Label>
                  <Textarea
                    id="scriptContent"
                    placeholder="Paste your Lua script here..."
                    value={newScript.content}
                    onChange={(e) => setNewScript({ ...newScript, content: e.target.value })}
                    className="bg-input min-h-[300px] font-mono"
                  />
                </div>

                <Button onClick={handleSaveScript} className="w-full">
                  Save Script
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <TabHelpSection {...scriptStorageHelp} />

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading scripts...
          </div>
        ) : scripts.length === 0 ? (
          <Card className="p-12 text-center cyber-border bg-card/30">
            <p className="text-muted-foreground mb-4">No scripts saved yet</p>
            <Button onClick={() => setDialogOpen(true)} variant="outline">
              Add Your First Script
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {scripts.map((script) => (
              <Card
                key={script.id}
                className="p-6 cyber-border bg-card/50 backdrop-blur-xl hover:scale-[1.02] transition-transform"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-xl font-semibold mb-1">{script.name}</h3>
                    {script.description && (
                      <p className="text-sm text-muted-foreground">{script.description}</p>
                    )}
                  </div>
                </div>

                <div className="bg-input/50 p-3 rounded-md mb-4 font-mono text-xs overflow-hidden">
                  <pre className="line-clamp-3">{script.script_content}</pre>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadScript(script)}
                    className="flex-1"
                  >
                    <Download size={16} className="mr-1" />
                    Download
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteScript(script.id)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground mt-3">
                  Saved {new Date(script.created_at).toLocaleDateString()}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Scripts;
