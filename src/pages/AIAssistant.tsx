import { useCallback, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Copy, Eye, Code2, Plus, FileCode2, Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StudioChat } from "@/components/studio/StudioChat";
import { CodePreview } from "@/components/studio/CodePreview";
import type { RInstance, StudioFile } from "@/components/studio/types";
import { uid } from "@/components/studio/utils";

const LANG_OPTIONS = [
  { ext: "lua", label: "Lua" },
  { ext: "html", label: "HTML" },
  { ext: "css", label: "CSS" },
  { ext: "javascript", label: "JS" },
  { ext: "typescript", label: "TS" },
  { ext: "json", label: "JSON" },
  { ext: "markdown", label: "MD" },
];

const AIAssistant = () => {
  const [files, setFiles] = useState<StudioFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [view, setView] = useState<"editor" | "preview">("editor");
  const { toast } = useToast();

  const activeFile = files.find((f) => f.id === activeFileId) ?? null;

  const updateFile = useCallback((id: string, content: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, content } : f)));
  }, []);

  const createFile = useCallback((file: StudioFile) => {
    setFiles((prev) => [...prev, file]);
    setActiveFileId(file.id);
    setView("editor");
  }, []);

  const deleteFile = useCallback((id: string) => {
    setFiles((prev) => {
      const next = prev.filter((f) => f.id !== id);
      setActiveFileId((cur) => (cur === id ? (next[0]?.id ?? null) : cur));
      return next;
    });
  }, []);

  const newBlankFile = useCallback((language: string) => {
    const ext = language === "javascript" ? "js" : language === "typescript" ? "ts" : language === "markdown" ? "md" : language;
    createFile({
      id: uid(),
      name: `untitled-${files.length + 1}.${ext}`,
      language,
      content: "",
    });
  }, [createFile, files.length]);

  // Stub — chat still expects this prop but designer is gone
  const applyAIUI = useCallback((_instances: RInstance[]) => {
    toast({ title: "UI Designer removed", description: "Lua was not auto-rendered, but it's saved as a file." });
  }, [toast]);

  const previewLanguage = useMemo(() => activeFile?.language ?? "plaintext", [activeFile]);
  const previewCode = useMemo(() => activeFile?.content ?? "", [activeFile]);

  const downloadActive = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col bg-background overflow-hidden">
        {/* Branded top bar */}
        <div className="shrink-0 px-6 py-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl glass-card flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">AI Studio</h1>
              <p className="text-xs text-muted-foreground">Build, edit, and preview code with the assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeFile && (
              <>
                <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => { navigator.clipboard.writeText(activeFile.content); toast({ title: "Copied" }); }}>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
                <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={downloadActive}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </>
            )}
          </div>
        </div>

        <PanelGroup direction="horizontal" className="flex-1 p-3 gap-3">
          {/* LEFT: Files panel */}
          <Panel defaultSize={18} minSize={14}>
            <div className="h-full glass-card rounded-2xl flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Files</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{files.length}</span>
              </div>

              <div className="px-3 py-2 border-b border-border/50">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 px-1">New file</div>
                <div className="grid grid-cols-3 gap-1">
                  {LANG_OPTIONS.map((l) => (
                    <Button
                      key={l.ext}
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[10px] px-1 hover:bg-foreground/5"
                      onClick={() => newBlankFile(l.ext === "js" ? "javascript" : l.ext === "ts" ? "typescript" : l.ext)}
                    >
                      <Plus className="h-2.5 w-2.5 mr-0.5" />
                      {l.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {files.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-8 px-3">
                    No files yet. Ask the AI for code or create a blank file above.
                  </div>
                )}
                {files.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => { setActiveFileId(f.id); setView("editor"); }}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                      activeFileId === f.id
                        ? "bg-foreground/10 text-foreground"
                        : "hover:bg-foreground/5 text-muted-foreground"
                    }`}
                  >
                    <span className="truncate flex-1">{f.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteFile(f.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1.5 bg-transparent hover:bg-foreground/10 rounded-full transition-colors" />

          {/* CENTER: Editor + Preview */}
          <Panel defaultSize={52} minSize={30}>
            <div className="h-full glass-card rounded-2xl flex flex-col overflow-hidden">
              <Tabs value={view} onValueChange={(v) => setView(v as "editor" | "preview")} className="h-full flex flex-col">
                <div className="px-4 py-2.5 border-b border-border/50 flex items-center justify-between">
                  <TabsList className="h-9 bg-foreground/5 border border-border/50 rounded-xl p-1 gap-1">
                    <TabsTrigger
                      value="editor"
                      className="h-7 px-3 text-xs gap-1.5 rounded-lg data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm"
                    >
                      <Code2 className="h-3.5 w-3.5" /> Editor
                    </TabsTrigger>
                    <TabsTrigger
                      value="preview"
                      className="h-7 px-3 text-xs gap-1.5 rounded-lg data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm"
                    >
                      <Eye className="h-3.5 w-3.5" /> Live Preview
                    </TabsTrigger>
                  </TabsList>
                  {activeFile && (
                    <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">{activeFile.name}</span>
                  )}
                </div>

                <TabsContent value="editor" className="flex-1 m-0 overflow-hidden">
                  {activeFile ? (
                    <Editor
                      height="100%"
                      language={activeFile.language === "tsx" ? "typescript" : activeFile.language}
                      value={activeFile.content}
                      theme="vs-dark"
                      onChange={(v) => updateFile(activeFile.id, v ?? "")}
                      options={{
                        fontSize: 14,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                        automaticLayout: true,
                        padding: { top: 16, bottom: 16 },
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      }}
                    />
                  ) : (
                    <EmptyState
                      title="No file open"
                      description="Pick a file on the left, create a blank one, or ask the AI to generate code."
                    />
                  )}
                </TabsContent>

                <TabsContent value="preview" className="flex-1 m-0 overflow-hidden bg-background">
                  {activeFile ? (
                    <CodePreview language={previewLanguage} code={previewCode} />
                  ) : (
                    <EmptyState
                      title="Nothing to preview"
                      description="Open a file to see a live preview here."
                    />
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1.5 bg-transparent hover:bg-foreground/10 rounded-full transition-colors" />

          {/* RIGHT: Chat (bigger) */}
          <Panel defaultSize={30} minSize={22}>
            <div className="h-full glass-card rounded-2xl overflow-hidden">
              <StudioChat
                onApplyUI={applyAIUI}
                onCreateFile={createFile}
                uiInstances={[]}
              />
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </DashboardLayout>
  );
};

const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="h-full flex items-center justify-center px-6">
    <div className="text-center space-y-2 max-w-sm">
      <div className="h-12 w-12 rounded-2xl glass-card mx-auto flex items-center justify-center">
        <Sparkles className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  </div>
);

export default AIAssistant;
