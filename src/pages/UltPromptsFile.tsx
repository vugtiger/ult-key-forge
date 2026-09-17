import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Download, Search, FileText, Box } from "lucide-react";
import { getUltPrompts, ULT_PROMPT_CATEGORIES, TOTAL_PROMPTS, type UltPrompt } from "@/lib/ultClonePrompts";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 24;

const UltPromptsFile = () => {
  const { toast } = useToast();
  const all = useMemo(() => getUltPrompts(), []);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [scale, setScale] = useState("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<UltPrompt | null>(null);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return all.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (scale !== "all" && p.scale !== scale) return false;
      if (qq && !p.name.toLowerCase().includes(qq) && !p.theme.toLowerCase().includes(qq) && !p.category.toLowerCase().includes(qq)) return false;
      return true;
    });
  }, [all, q, category, scale]);

  const visible = filtered.slice(0, page * PAGE_SIZE);

  const copy = (p: UltPrompt) => {
    navigator.clipboard.writeText(p.body);
    toast({ title: "Prompt copied", description: `${p.name} is on your clipboard. Paste it into any AI builder.` });
  };

  const downloadOne = (p: UltPrompt) => {
    saveFile(`${p.name.replace(/\s+/g, "-").toLowerCase()}.txt`, p.body);
  };

  const downloadAll = (list: UltPrompt[], label: string) => {
    const text = list
      .map((p) => `===== #${p.index} — ${p.name} (${p.theme} / ${p.category} / ${p.scale}) =====\n\n${p.body}\n`)
      .join("\n\n");
    saveFile(label, text);
    toast({ title: "Download started", description: `${list.length.toLocaleString()} prompts saved to your device.` });
  };

  const saveFile = (filename: string, text: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold">Build-Like-ULT Prompts</h1>
            <Badge variant="secondary">{TOTAL_PROMPTS.toLocaleString()} prompts</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {TOTAL_PROMPTS.toLocaleString()} ready-to-send prompts. Each one asks an AI builder to create a full
            script-protection platform like ULT — with its own name, theme, palette, layout, motion and feature set —
            and holds it to a higher quality bar than ULT itself.
          </p>
        </div>

        <Card className="p-3 md:p-4 space-y-3 bg-card/60 backdrop-blur-xl border-border/60">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search by brand name, theme, or category…"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Theme category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All themes</SelectItem>
                {ULT_PROMPT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={scale} onValueChange={(v) => { setScale(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Size" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any size</SelectItem>
                <SelectItem value="lean">Lean</SelectItem>
                <SelectItem value="full">Full</SelectItem>
                <SelectItem value="flagship">Flagship</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => downloadAll(filtered, "ult-prompts-filtered.txt")}>
              <Download className="h-4 w-4 mr-2" /> Download these ({filtered.length.toLocaleString()})
            </Button>
            <Button onClick={() => downloadAll(all, "ult-prompts-8000.txt")}>
              <Download className="h-4 w-4 mr-2" /> Download all {TOTAL_PROMPTS.toLocaleString()}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Showing <span className="text-foreground font-medium">{visible.length}</span> of {filtered.length.toLocaleString()}
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map((p) => (
            <Card
              key={p.id}
              className="p-4 bg-card/60 backdrop-blur-xl border-border/60 hover:border-primary/50 transition-colors cursor-pointer flex flex-col gap-3"
              onClick={() => setOpen(p)}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm leading-tight">#{p.index} · {p.name}</h3>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px]">{p.theme}</Badge>
                <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
                <Badge variant="outline" className="text-[10px] capitalize">{p.scale}</Badge>
                {p.is3D && <Badge variant="outline" className="text-[10px]"><Box className="h-2.5 w-2.5 mr-0.5" />3D</Badge>}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                {p.body.split("\n")[2]}
              </p>
              <div className="flex gap-2 mt-auto pt-1">
                <Button size="sm" variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); copy(p); }}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
                </Button>
                <Button size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); setOpen(p); }}>View</Button>
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

        <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>#{open?.index} · {open?.name}</DialogTitle>
            </DialogHeader>
            {open && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{open.theme}</Badge>
                  <Badge variant="outline">{open.category}</Badge>
                  <Badge variant="secondary" className="capitalize">{open.scale}</Badge>
                </div>
                <pre className="flex-1 overflow-y-auto whitespace-pre-wrap text-[12.5px] leading-relaxed bg-muted/40 border border-border/50 rounded-lg p-4 font-mono">
                  {open.body}
                </pre>
                <div className="flex gap-2">
                  <Button onClick={() => copy(open)} className="flex-1">
                    <Copy className="h-4 w-4 mr-2" /> Copy prompt
                  </Button>
                  <Button variant="outline" onClick={() => downloadOne(open)} className="flex-1">
                    <Download className="h-4 w-4 mr-2" /> Download .txt
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

export default UltPromptsFile;
