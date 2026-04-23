import { useState } from "react";
import type { StudioFile } from "./types";
import { ChevronRight, ChevronDown, FileCode, FileText, X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface FileTreeProps {
  files: StudioFile[];
  activeFileId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: (file: StudioFile) => void;
}

const iconFor = (lang: string) => {
  if (["html", "css", "javascript", "typescript", "tsx"].includes(lang)) return <FileCode className="h-3.5 w-3.5 text-orange-400" />;
  if (lang === "lua") return <FileCode className="h-3.5 w-3.5 text-blue-400" />;
  if (lang === "json") return <FileCode className="h-3.5 w-3.5 text-yellow-400" />;
  return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
};

const detectLang = (name: string): StudioFile["language"] => {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "lua": return "lua";
    case "html": case "htm": return "html";
    case "css": return "css";
    case "js": case "mjs": return "javascript";
    case "ts": return "typescript";
    case "tsx": case "jsx": return "tsx";
    case "json": return "json";
    case "md": return "markdown";
    default: return "plaintext";
  }
};

export const FileTree = ({ files, activeFileId, onOpen, onDelete, onCreate }: FileTreeProps) => {
  const [expanded, setExpanded] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("untitled.lua");

  return (
    <div className="text-xs">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border">
        <button
          className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Files
        </button>
        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setShowNew(true)}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      {expanded && (
        <div className="py-1">
          {files.length === 0 && (
            <div className="px-3 py-2 text-[11px] text-muted-foreground italic">No files yet</div>
          )}
          {files.map((f) => (
            <div
              key={f.id}
              className={cn(
                "group flex items-center gap-1.5 px-2 py-1 hover:bg-muted/50 cursor-pointer",
                activeFileId === f.id && "bg-muted",
              )}
              onClick={() => onOpen(f.id)}
            >
              {iconFor(f.language)}
              <span className="flex-1 truncate">{f.name}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); onDelete(f.id); }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>New file</DialogTitle></DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                onCreate({
                  id: Math.random().toString(36).slice(2, 10),
                  name: newName.trim(),
                  language: detectLang(newName),
                  content: "",
                });
                setShowNew(false);
                setNewName("untitled.lua");
              }
            }}
            placeholder="filename.ext"
            autoFocus
          />
          <Button onClick={() => {
            if (!newName.trim()) return;
            onCreate({
              id: Math.random().toString(36).slice(2, 10),
              name: newName.trim(),
              language: detectLang(newName),
              content: "",
            });
            setShowNew(false);
            setNewName("untitled.lua");
          }}>Create</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface TabBarProps {
  files: StudioFile[];
  openTabs: string[];
  activeFileId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export const TabBar = ({ files, openTabs, activeFileId, onSelect, onClose }: TabBarProps) => {
  const tabs = openTabs.map((id) => files.find((f) => f.id === id)).filter(Boolean) as StudioFile[];
  if (tabs.length === 0) return null;
  return (
    <div className="flex items-end border-b border-border bg-muted/30 overflow-x-auto">
      {tabs.map((f) => (
        <div
          key={f.id}
          className={cn(
            "group flex items-center gap-2 px-3 py-1.5 text-xs border-r border-border cursor-pointer min-w-0",
            activeFileId === f.id ? "bg-background text-foreground" : "text-muted-foreground hover:bg-muted/50",
          )}
          onClick={() => onSelect(f.id)}
        >
          {iconFor(f.language)}
          <span className="truncate max-w-[140px]">{f.name}</span>
          <button
            className="opacity-50 hover:opacity-100 ml-1"
            onClick={(e) => { e.stopPropagation(); onClose(f.id); }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
};
