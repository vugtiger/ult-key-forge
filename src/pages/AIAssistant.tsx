import { useCallback, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sparkles, Copy, Download, Sun, Moon, Plus, Eye, Layers, Code2,
  Square, Type, MousePointer2, Image as ImageIcon, Box, Wrench, Palette,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FileTree, TabBar } from "@/components/studio/FileTree";
import { StudioChat } from "@/components/studio/StudioChat";
import { Explorer } from "@/components/studio/Explorer";
import { DesignerCanvas } from "@/components/studio/DesignerCanvas";
import { Properties } from "@/components/studio/Properties";
import { CodePreview } from "@/components/studio/CodePreview";
import type { InstanceClass, RInstance, StudioFile } from "@/components/studio/types";
import { defaultInstance, exportToLua, nextIndexFor, uid } from "@/components/studio/utils";

const INSTANCE_PALETTE: { cls: InstanceClass; icon: JSX.Element; label: string }[] = [
  { cls: "Frame", icon: <Square className="h-3.5 w-3.5" />, label: "Frame" },
  { cls: "ScrollingFrame", icon: <Box className="h-3.5 w-3.5" />, label: "Scroll" },
  { cls: "TextLabel", icon: <Type className="h-3.5 w-3.5" />, label: "Label" },
  { cls: "TextButton", icon: <MousePointer2 className="h-3.5 w-3.5" />, label: "Button" },
  { cls: "TextBox", icon: <Type className="h-3.5 w-3.5" />, label: "Input" },
  { cls: "ImageLabel", icon: <ImageIcon className="h-3.5 w-3.5" />, label: "Image" },
  { cls: "ImageButton", icon: <ImageIcon className="h-3.5 w-3.5" />, label: "ImgBtn" },
];

const MODIFIERS: InstanceClass[] = [
  "UICorner", "UIStroke", "UIGradient", "UIPadding",
  "UIListLayout", "UIGridLayout", "UIAspectRatioConstraint", "UISizeConstraint",
];

const newProject = () => {
  const sg = defaultInstance("ScreenGui", null);
  return {
    files: [] as StudioFile[],
    activeFileId: null as string | null,
    openTabs: [] as string[],
    uiInstances: [sg] as RInstance[],
    selectedInstanceId: sg.id,
    canvasSize: { width: 600, height: 400 },
    theme: "dark" as "dark" | "light",
  };
};

const AIAssistant = () => {
  const [project, setProject] = useState(newProject);
  const [bottomTab, setBottomTab] = useState<"preview" | "console">("preview");
  const [mainTab, setMainTab] = useState<"editor" | "designer">("designer");
  const { toast } = useToast();

  const activeFile = project.files.find((f) => f.id === project.activeFileId) ?? null;
  const selectedInstance = project.uiInstances.find((i) => i.id === project.selectedInstanceId) ?? null;

  const updateFile = useCallback((id: string, content: string) => {
    setProject((p) => ({
      ...p,
      files: p.files.map((f) => (f.id === id ? { ...f, content } : f)),
    }));
  }, []);

  const openFile = useCallback((id: string) => {
    setProject((p) => ({
      ...p,
      activeFileId: id,
      openTabs: p.openTabs.includes(id) ? p.openTabs : [...p.openTabs, id],
    }));
    setMainTab("editor");
  }, []);

  const closeTab = useCallback((id: string) => {
    setProject((p) => {
      const openTabs = p.openTabs.filter((t) => t !== id);
      const activeFileId = p.activeFileId === id ? (openTabs[openTabs.length - 1] ?? null) : p.activeFileId;
      return { ...p, openTabs, activeFileId };
    });
  }, []);

  const createFile = useCallback((file: StudioFile) => {
    setProject((p) => ({
      ...p,
      files: [...p.files, file],
      openTabs: [...p.openTabs, file.id],
      activeFileId: file.id,
    }));
    setMainTab("editor");
  }, []);

  const deleteFile = useCallback((id: string) => {
    setProject((p) => {
      const files = p.files.filter((f) => f.id !== id);
      const openTabs = p.openTabs.filter((t) => t !== id);
      return {
        ...p,
        files,
        openTabs,
        activeFileId: p.activeFileId === id ? (openTabs[openTabs.length - 1] ?? null) : p.activeFileId,
      };
    });
  }, []);

  const addInstance = useCallback((cls: InstanceClass) => {
    setProject((p) => {
      const parent = p.selectedInstanceId
        ? p.uiInstances.find((i) => i.id === p.selectedInstanceId)
        : p.uiInstances.find((i) => i.className === "ScreenGui");
      if (!parent) return p;
      // Modifiers go inside the selected GUI; GUIs go inside ScreenGui or selected container
      const isModifier = MODIFIERS.includes(cls);
      const targetParent = isModifier
        ? parent
        : (parent.className === "ScreenGui" || parent.className === "Frame" || parent.className === "ScrollingFrame" || parent.className === "ImageButton" || parent.className === "TextButton")
          ? parent
          : p.uiInstances.find((i) => i.className === "ScreenGui")!;
      const inst = defaultInstance(cls, targetParent.id, nextIndexFor(cls, p.uiInstances));
      return {
        ...p,
        uiInstances: [...p.uiInstances, inst],
        selectedInstanceId: inst.id,
      };
    });
    setMainTab("designer");
  }, []);

  const updateInstance = useCallback((id: string, patch: Partial<RInstance>) => {
    setProject((p) => ({
      ...p,
      uiInstances: p.uiInstances.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  }, []);

  const deleteInstance = useCallback((id: string) => {
    setProject((p) => {
      // Recursively collect descendants
      const toDelete = new Set<string>([id]);
      let added = true;
      while (added) {
        added = false;
        for (const inst of p.uiInstances) {
          if (inst.parentId && toDelete.has(inst.parentId) && !toDelete.has(inst.id)) {
            toDelete.add(inst.id);
            added = true;
          }
        }
      }
      return {
        ...p,
        uiInstances: p.uiInstances.filter((i) => !toDelete.has(i.id)),
        selectedInstanceId: toDelete.has(p.selectedInstanceId ?? "") ? null : p.selectedInstanceId,
      };
    });
  }, []);

  const reparentInstance = useCallback((id: string, newParentId: string) => {
    setProject((p) => {
      // Prevent cycles
      const ancestors = new Set<string>();
      let cursor: string | null = newParentId;
      while (cursor) {
        ancestors.add(cursor);
        cursor = p.uiInstances.find((i) => i.id === cursor)?.parentId ?? null;
      }
      if (ancestors.has(id)) return p;
      return {
        ...p,
        uiInstances: p.uiInstances.map((i) => (i.id === id ? { ...i, parentId: newParentId } : i)),
      };
    });
  }, []);

  const applyAIUI = useCallback((instances: RInstance[]) => {
    setProject((p) => ({
      ...p,
      uiInstances: instances,
      selectedInstanceId: instances.find((i) => i.className === "ScreenGui")?.id ?? null,
    }));
    setMainTab("designer");
    toast({ title: "UI loaded", description: `${instances.length} instances rendered on canvas.` });
  }, [toast]);

  const exportLua = useCallback(() => {
    const lua = exportToLua(project.uiInstances);
    createFile({ id: uid(), name: `ui-export-${Date.now()}.lua`, language: "lua", content: lua });
    navigator.clipboard.writeText(lua).catch(() => {});
    toast({ title: "Exported", description: "Lua copied to clipboard and saved as a file." });
  }, [project.uiInstances, createFile, toast]);

  const previewLanguage = useMemo(() => activeFile?.language ?? "plaintext", [activeFile]);
  const previewCode = useMemo(() => activeFile?.content ?? "", [activeFile]);

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col bg-background overflow-hidden">
        {/* Top bar */}
        <div className="h-10 border-b border-border flex items-center justify-between px-3 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">AI Studio</span>
            <span className="text-[10px] text-muted-foreground ml-2">Roblox UI Designer + Code Editor</span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5" onClick={() => setProject((p) => ({ ...p, theme: p.theme === "dark" ? "light" : "dark" }))}>
              {project.theme === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              Canvas
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5" onClick={exportLua}>
              <Download className="h-3.5 w-3.5" /> Export Lua
            </Button>
          </div>
        </div>

        <PanelGroup direction="horizontal" className="flex-1">
          {/* LEFT: file tree + explorer */}
          <Panel defaultSize={16} minSize={12}>
            <div className="h-full flex flex-col border-r border-border">
              <FileTree
                files={project.files}
                activeFileId={project.activeFileId}
                onOpen={openFile}
                onDelete={deleteFile}
                onCreate={createFile}
              />
              <div className="border-t border-border flex-1 overflow-y-auto">
                <div className="px-2 py-1.5 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  Explorer
                </div>
                <Explorer
                  instances={project.uiInstances}
                  selectedId={project.selectedInstanceId}
                  onSelect={(selectedInstanceId) => setProject((p) => ({ ...p, selectedInstanceId }))}
                  onRename={(id, name) => updateInstance(id, { name })}
                  onDelete={deleteInstance}
                  onReparent={reparentInstance}
                />
              </div>
            </div>
          </Panel>
          <PanelResizeHandle className="w-px bg-border hover:bg-blue-500/50 transition-colors" />

          {/* CENTER: editor / designer */}
          <Panel defaultSize={56} minSize={30}>
            <PanelGroup direction="vertical">
              <Panel defaultSize={70} minSize={30}>
                <div className="h-full flex flex-col">
                  <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "editor" | "designer")} className="h-full flex flex-col">
                    <div className="flex items-center justify-between border-b border-border px-2 shrink-0">
                      <TabsList className="h-9 bg-transparent border-0 rounded-none p-0">
                        <TabsTrigger value="designer" className="h-9 data-[state=active]:bg-background data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 gap-1.5 text-xs">
                          <Layers className="h-3.5 w-3.5" /> UI Designer
                        </TabsTrigger>
                        <TabsTrigger value="editor" className="h-9 data-[state=active]:bg-background data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 gap-1.5 text-xs">
                          <Code2 className="h-3.5 w-3.5" /> Code Editor
                        </TabsTrigger>
                      </TabsList>
                      {mainTab === "designer" && (
                        <div className="flex items-center gap-1 py-1 overflow-x-auto">
                          {INSTANCE_PALETTE.map((p) => (
                            <Button key={p.cls} size="sm" variant="ghost" className="h-7 text-[11px] gap-1 px-2" onClick={() => addInstance(p.cls)}>
                              {p.icon} {p.label}
                            </Button>
                          ))}
                          <div className="w-px h-5 bg-border mx-1" />
                          {MODIFIERS.map((cls) => (
                            <Button key={cls} size="sm" variant="ghost" className="h-7 text-[11px] gap-1 px-2" onClick={() => addInstance(cls)} title={cls}>
                              {cls === "UIGradient" ? <Palette className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
                              {cls.replace("UI", "")}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>

                    <TabsContent value="designer" className="flex-1 m-0 overflow-hidden">
                      <DesignerCanvas
                        instances={project.uiInstances}
                        selectedId={project.selectedInstanceId}
                        onSelect={(selectedInstanceId) => setProject((p) => ({ ...p, selectedInstanceId }))}
                        onUpdate={updateInstance}
                        canvasSize={project.canvasSize}
                        theme={project.theme}
                      />
                    </TabsContent>

                    <TabsContent value="editor" className="flex-1 m-0 flex flex-col overflow-hidden">
                      <TabBar
                        files={project.files}
                        openTabs={project.openTabs}
                        activeFileId={project.activeFileId}
                        onSelect={openFile}
                        onClose={closeTab}
                      />
                      <div className="flex-1 overflow-hidden">
                        {activeFile ? (
                          <Editor
                            height="100%"
                            language={activeFile.language === "tsx" ? "typescript" : activeFile.language}
                            value={activeFile.content}
                            theme="vs-dark"
                            onChange={(v) => updateFile(activeFile.id, v ?? "")}
                            options={{
                              fontSize: 13,
                              minimap: { enabled: false },
                              scrollBeyondLastLine: false,
                              wordWrap: "on",
                              automaticLayout: true,
                            }}
                          />
                        ) : (
                          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                            <div className="text-center space-y-1">
                              <FileTreeEmptyIcon />
                              <div>Open or create a file to start coding</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </Panel>
              <PanelResizeHandle className="h-px bg-border hover:bg-blue-500/50 transition-colors" />

              {/* BOTTOM: preview */}
              <Panel defaultSize={30} minSize={15}>
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between border-b border-border px-2 h-8 shrink-0">
                    <Tabs value={bottomTab} onValueChange={(v) => setBottomTab(v as "preview" | "console")}>
                      <TabsList className="h-7 bg-transparent border-0 rounded-none p-0">
                        <TabsTrigger value="preview" className="h-7 data-[state=active]:bg-muted/50 data-[state=active]:shadow-none rounded gap-1.5 text-[11px] px-2">
                          <Eye className="h-3 w-3" /> Live Preview
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    {activeFile && (
                      <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1" onClick={() => { navigator.clipboard.writeText(activeFile.content); toast({ title: "Copied" }); }}>
                        <Copy className="h-3 w-3" /> Copy
                      </Button>
                    )}
                  </div>
                  <div className="flex-1 overflow-hidden bg-muted/20">
                    <CodePreview language={previewLanguage} code={previewCode} />
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
          <PanelResizeHandle className="w-px bg-border hover:bg-blue-500/50 transition-colors" />

          {/* RIGHT: chat or properties */}
          <Panel defaultSize={28} minSize={20}>
            <PanelGroup direction="vertical">
              <Panel defaultSize={selectedInstance ? 55 : 100} minSize={30}>
                <StudioChat
                  onApplyUI={applyAIUI}
                  onCreateFile={createFile}
                  uiInstances={project.uiInstances}
                />
              </Panel>
              {selectedInstance && (
                <>
                  <PanelResizeHandle className="h-px bg-border hover:bg-blue-500/50 transition-colors" />
                  <Panel defaultSize={45} minSize={20}>
                    <div className="h-full flex flex-col border-l border-border">
                      <div className="px-2 py-1.5 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                        Properties
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        <Properties inst={selectedInstance} onUpdate={(patch) => updateInstance(selectedInstance.id, patch)} />
                      </div>
                    </div>
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </DashboardLayout>
  );
};

const FileTreeEmptyIcon = () => (
  <Plus className="h-8 w-8 mx-auto opacity-30" />
);

export default AIAssistant;
