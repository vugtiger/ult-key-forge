import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Search, Sparkles, Box, Zap, Crown, Layers } from "lucide-react";
import { getDailyPrompts, CATEGORIES, type GeneratedPrompt, type PromptTier, type FeatureSize } from "@/lib/promptGenerator";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 24;

const Prompts = () => {
  const { toast } = useToast();
  const all = useMemo(() => getDailyPrompts(), []);
  const [size, setSize] = useState<"all" | FeatureSize>("all");
  const [dim, setDim] = useState<"all" | "3D" | "2D">("all");
  const [category, setCategory] = useState<string>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<GeneratedPrompt | null>(null);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return all.filter((p) => {
      if (size !== "all" && p.featureSize !== size) return false;
      if (dim !== "all" && (dim === "3D") !== p.is3D) return false;
      if (category !== "all" && p.category !== category) return false;
      if (qq && !p.title.toLowerCase().includes(qq) && !p.category.toLowerCase().includes(qq)) return false;
      return true;
    });
  }, [all, tier, size, dim, category, q]);

  const visible = filtered.slice(0, page * PAGE_SIZE);

  const copy = (p: GeneratedPrompt) => {
    navigator.clipboard.writeText(p.body);
    toast({ title: "Prompt copied", description: "Paste into any AI builder (like Lovable) and ship it." });
  };

  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setUTCHours(24, 0, 0, 0);
    return d;
  }, []);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold">Prompt Vault</h1>
            <Badge variant="secondary" className="ml-1">{all.length.toLocaleString()} prompts</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Long-form prompts for building protection platforms like this one — every prompt is a different theme, logo, name, and feature set.
            New rotation drops every 24h (next at {tomorrow.toUTCString().slice(17, 22)} UTC).
          </p>
        </div>

        {/* Filters */}
        <Card className="p-3 md:p-4 space-y-3 bg-card/60 backdrop-blur-xl border-border/60">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search by name, theme, or category…"
              className="pl-9"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Tabs value={size} onValueChange={(v) => { setSize(v as any); setPage(1); }} className="min-w-0 max-w-full">
              <TabsList className="flex w-full max-w-full overflow-x-auto">
                <TabsTrigger value="all" className="flex-1 whitespace-nowrap text-xs">Any</TabsTrigger>
                <TabsTrigger value="small" className="flex-1 whitespace-nowrap text-xs">Small</TabsTrigger>
                <TabsTrigger value="big" className="flex-1 whitespace-nowrap text-xs"><Layers className="h-3.5 w-3.5 mr-1" />Big</TabsTrigger>
              </TabsList>
            </Tabs>

            <Tabs value={dim} onValueChange={(v) => { setDim(v as any); setPage(1); }} className="min-w-0 max-w-full">
              <TabsList className="flex w-full max-w-full overflow-x-auto">
                <TabsTrigger value="all" className="flex-1 whitespace-nowrap text-xs">2D + 3D</TabsTrigger>
                <TabsTrigger value="3D" className="flex-1 whitespace-nowrap text-xs"><Box className="h-3.5 w-3.5 mr-1" />3D</TabsTrigger>
                <TabsTrigger value="2D" className="flex-1 whitespace-nowrap text-xs">2D</TabsTrigger>
              </TabsList>
            </Tabs>

            <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground">
            Showing <span className="text-foreground font-medium">{visible.length}</span> of {filtered.length.toLocaleString()} matching prompts
          </div>
        </Card>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map((p) => (
            <Card
              key={p.id}
              className="p-4 bg-card/60 backdrop-blur-xl border-border/60 hover:border-primary/50 transition-colors cursor-pointer flex flex-col gap-3"
              onClick={() => setOpen(p)}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm leading-tight">{p.title}</h3>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
                <Badge variant="outline" className="text-[10px]">
                  {p.featureSize === "big" ? "Many features" : "Lean"}
                </Badge>
                {p.is3D && <Badge variant="outline" className="text-[10px]"><Box className="h-2.5 w-2.5 mr-0.5" />3D</Badge>}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                {p.body.split("\n").find((l) => l.trim().length > 50)?.slice(0, 220)}…
              </p>
              <div className="flex gap-2 mt-auto pt-1">
                <Button size="sm" variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); copy(p); }}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
                </Button>
                <Button size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); setOpen(p); }}>
                  View
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {visible.length < filtered.length && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
              Load {Math.min(PAGE_SIZE, filtered.length - visible.length)} more
            </Button>
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {open?.title}
              </DialogTitle>
            </DialogHeader>
            {open && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{open.category}</Badge>
                  <Badge variant="outline">{open.featureSize === "big" ? "Many features" : "Lean"}</Badge>
                  {open.is3D && <Badge variant="outline"><Box className="h-3 w-3 mr-1" />3D</Badge>}
                </div>
                <pre className="flex-1 overflow-y-auto whitespace-pre-wrap text-[12.5px] leading-relaxed bg-muted/40 border border-border/50 rounded-lg p-4 font-mono">
                  {open.body}
                </pre>
                <div className="flex gap-2">
                  <Button onClick={() => copy(open)} className="flex-1">
                    <Copy className="h-4 w-4 mr-2" /> Copy full prompt
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Prompts;
