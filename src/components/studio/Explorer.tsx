import { useState } from "react";
import type { InstanceClass, RInstance } from "./types";
import { ChevronRight, ChevronDown, Trash2, Box, Square, Type, MousePointer2, Image as ImageIcon, Layers, Palette, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const ICONS: Partial<Record<InstanceClass, JSX.Element>> = {
  ScreenGui: <Layers className="h-3.5 w-3.5" />,
  Frame: <Square className="h-3.5 w-3.5" />,
  ScrollingFrame: <Box className="h-3.5 w-3.5" />,
  TextLabel: <Type className="h-3.5 w-3.5" />,
  TextButton: <MousePointer2 className="h-3.5 w-3.5" />,
  TextBox: <Type className="h-3.5 w-3.5" />,
  ImageLabel: <ImageIcon className="h-3.5 w-3.5" />,
  ImageButton: <ImageIcon className="h-3.5 w-3.5" />,
  UICorner: <Wrench className="h-3.5 w-3.5" />,
  UIStroke: <Wrench className="h-3.5 w-3.5" />,
  UIGradient: <Palette className="h-3.5 w-3.5" />,
  UIPadding: <Wrench className="h-3.5 w-3.5" />,
  UIListLayout: <Wrench className="h-3.5 w-3.5" />,
  UIGridLayout: <Wrench className="h-3.5 w-3.5" />,
  UIAspectRatioConstraint: <Wrench className="h-3.5 w-3.5" />,
  UISizeConstraint: <Wrench className="h-3.5 w-3.5" />,
  UITextSizeConstraint: <Wrench className="h-3.5 w-3.5" />,
};

interface ExplorerProps {
  instances: RInstance[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onReparent: (id: string, newParentId: string) => void;
}

const Node = ({
  inst, all, depth, selectedId, expanded, setExpanded, onSelect, onRename, onDelete, onReparent,
}: {
  inst: RInstance;
  all: RInstance[];
  depth: number;
  selectedId: string | null;
  expanded: Set<string>;
  setExpanded: (s: Set<string>) => void;
  onSelect: (id: string) => void;
  onRename: (id: string, n: string) => void;
  onDelete: (id: string) => void;
  onReparent: (id: string, newParentId: string) => void;
}) => {
  const children = all.filter((c) => c.parentId === inst.id);
  const isOpen = expanded.has(inst.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(inst.name);
  const isSelected = selectedId === inst.id;

  return (
    <div>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/x-instance-id", inst.id);
          e.stopPropagation();
        }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const dragged = e.dataTransfer.getData("text/x-instance-id");
          if (dragged && dragged !== inst.id) onReparent(dragged, inst.id);
        }}
        className={cn(
          "flex items-center gap-1 px-1 py-0.5 hover:bg-muted/50 cursor-pointer text-xs",
          isSelected && "bg-blue-500/20 hover:bg-blue-500/30",
        )}
        style={{ paddingLeft: depth * 12 + 4 }}
        onClick={(e) => { e.stopPropagation(); onSelect(inst.id); }}
      >
        {children.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const next = new Set(expanded);
              isOpen ? next.delete(inst.id) : next.add(inst.id);
              setExpanded(next);
            }}
            className="hover:bg-muted rounded"
          >
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3" />
        )}
        <span className="text-muted-foreground">{ICONS[inst.className] ?? <Box className="h-3.5 w-3.5" />}</span>
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { setEditing(false); if (draft.trim()) onRename(inst.id, draft.trim()); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { setEditing(false); if (draft.trim()) onRename(inst.id, draft.trim()); }
              if (e.key === "Escape") { setEditing(false); setDraft(inst.name); }
            }}
            className="h-5 px-1 text-xs"
          />
        ) : (
          <span
            className="flex-1 truncate"
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
          >
            {inst.name}
          </span>
        )}
        {inst.className !== "ScreenGui" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); onDelete(inst.id); }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      {isOpen && children.map((c) => (
        <Node
          key={c.id}
          inst={c}
          all={all}
          depth={depth + 1}
          selectedId={selectedId}
          expanded={expanded}
          setExpanded={setExpanded}
          onSelect={onSelect}
          onRename={onRename}
          onDelete={onDelete}
          onReparent={onReparent}
        />
      ))}
    </div>
  );
};

export const Explorer = ({ instances, selectedId, onSelect, onRename, onDelete, onReparent }: ExplorerProps) => {
  const root = instances.find((i) => i.parentId === null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(instances.map((i) => i.id)));

  if (!root) return <div className="p-2 text-xs text-muted-foreground">No instances</div>;

  return (
    <div className="text-xs group">
      <Node
        inst={root}
        all={instances}
        depth={0}
        selectedId={selectedId}
        expanded={expanded}
        setExpanded={setExpanded}
        onSelect={onSelect}
        onRename={onRename}
        onDelete={onDelete}
        onReparent={onReparent}
      />
    </div>
  );
};
