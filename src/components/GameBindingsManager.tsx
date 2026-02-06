import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Gamepad2, Plus, Trash2, Lock, Unlock, ExternalLink } from "lucide-react";

interface Paste {
  id: string;
  title: string | null;
  slug: string;
  game_restriction_enabled: boolean | null;
}

interface GameBinding {
  id: string;
  paste_id: string;
  game_id: string;
  game_name: string | null;
  created_at: string;
}

const GameBindingsManager = () => {
  const [pastes, setPastes] = useState<Paste[]>([]);
  const [selectedPasteId, setSelectedPasteId] = useState<string>("");
  const [bindings, setBindings] = useState<GameBinding[]>([]);
  const [newGameId, setNewGameId] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPastes();
  }, []);

  useEffect(() => {
    if (selectedPasteId) {
      fetchBindings(selectedPasteId);
    }
  }, [selectedPasteId]);

  const fetchPastes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('pastes')
      .select('id, title, slug, game_restriction_enabled')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPastes(data);
      if (data.length > 0 && !selectedPasteId) {
        setSelectedPasteId(data[0].id);
      }
    }
    setLoading(false);
  };

  const fetchBindings = async (pasteId: string) => {
    const { data, error } = await supabase
      .from('paste_game_bindings')
      .select('*')
      .eq('paste_id', pasteId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setBindings(data);
    }
  };

  const extractGameId = (input: string): string | null => {
    // Handle full URL: https://www.roblox.com/games/109983668079237/Game-Name
    const urlMatch = input.match(/roblox\.com\/games\/(\d+)/);
    if (urlMatch) return urlMatch[1];
    
    // Handle just the number
    const numMatch = input.match(/^(\d+)$/);
    if (numMatch) return numMatch[1];
    
    return null;
  };

  const addGameBinding = async () => {
    if (!selectedPasteId) {
      toast({ title: "Error", description: "Please select a paste first", variant: "destructive" });
      return;
    }

    const gameId = extractGameId(newGameId.trim());
    if (!gameId) {
      toast({ 
        title: "Invalid Game ID", 
        description: "Please enter a valid Roblox game ID or URL", 
        variant: "destructive" 
      });
      return;
    }

    // Check if already exists
    if (bindings.some(b => b.game_id === gameId)) {
      toast({ title: "Already added", description: "This game is already bound to this paste", variant: "destructive" });
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from('paste_game_bindings')
        .insert({
          paste_id: selectedPasteId,
          game_id: gameId,
          game_name: null // Could fetch from Roblox API later
        });

      if (error) throw error;

      toast({ title: "Game Added", description: `Game ID ${gameId} bound to this paste` });
      setNewGameId("");
      fetchBindings(selectedPasteId);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const removeBinding = async (bindingId: string) => {
    try {
      const { error } = await supabase
        .from('paste_game_bindings')
        .delete()
        .eq('id', bindingId);

      if (error) throw error;

      toast({ title: "Removed", description: "Game binding removed" });
      setBindings(prev => prev.filter(b => b.id !== bindingId));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleGameRestriction = async (enabled: boolean) => {
    if (!selectedPasteId) return;

    try {
      const { error } = await supabase
        .from('pastes')
        .update({ game_restriction_enabled: enabled })
        .eq('id', selectedPasteId);

      if (error) throw error;

      toast({ 
        title: enabled ? "Game Restriction Enabled" : "Game Restriction Disabled",
        description: enabled 
          ? "Script will only work on bound games" 
          : "Script will work on any game"
      });

      setPastes(prev => prev.map(p => 
        p.id === selectedPasteId ? { ...p, game_restriction_enabled: enabled } : p
      ));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const selectedPaste = pastes.find(p => p.id === selectedPasteId);

  return (
    <Card className="cyber-border bg-card/50 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gamepad2 className="h-5 w-5" />
          Game ID Bindings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Paste Selector */}
        <div className="space-y-2">
          <Label>Select Paste</Label>
          <Select value={selectedPasteId} onValueChange={setSelectedPasteId}>
            <SelectTrigger className="bg-background/50">
              <SelectValue placeholder="Choose a paste..." />
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
          <>
            {/* Toggle Game Restriction */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/30 border border-border/30">
              <div className="flex items-center gap-2">
                {selectedPaste.game_restriction_enabled ? (
                  <Lock className="h-4 w-4 text-primary" />
                ) : (
                  <Unlock className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm">
                  {selectedPaste.game_restriction_enabled 
                    ? "Game Restriction Enabled" 
                    : "Game Restriction Disabled"}
                </span>
              </div>
              <Switch
                checked={selectedPaste.game_restriction_enabled || false}
                onCheckedChange={toggleGameRestriction}
              />
            </div>

            {/* Add Game ID */}
            <div className="space-y-2">
              <Label>Add Roblox Game</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter game ID or paste Roblox game URL..."
                  value={newGameId}
                  onChange={(e) => setNewGameId(e.target.value)}
                  className="bg-background/50 flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && addGameBinding()}
                />
                <Button 
                  onClick={addGameBinding} 
                  disabled={adding || !newGameId.trim()}
                  className="cyber-glow"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Example: https://www.roblox.com/games/109983668079237/Game-Name or just 109983668079237
              </p>
            </div>

            {/* Bound Games List */}
            <div className="space-y-2">
              <Label>Bound Games ({bindings.length})</Label>
              {bindings.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-border/50 text-center text-muted-foreground text-sm">
                  No games bound yet. Add a game ID above.
                </div>
              ) : (
                <div className="space-y-2">
                  {bindings.map((binding) => (
                    <div 
                      key={binding.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-background/30 border border-border/30"
                    >
                      <div className="flex items-center gap-3">
                        <Gamepad2 className="h-4 w-4 text-primary" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{binding.game_id}</span>
                            <a
                              href={`https://www.roblox.com/games/${binding.game_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                          {binding.game_name && (
                            <span className="text-xs text-muted-foreground">{binding.game_name}</span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeBinding(binding.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            {selectedPaste.game_restriction_enabled && bindings.length > 0 && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                <p className="text-xs text-primary">
                  ✓ This script will only execute on the {bindings.length} bound game{bindings.length > 1 ? 's' : ''}.
                  Users running it on other games will be kicked with a "Game not supported" message.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default GameBindingsManager;
