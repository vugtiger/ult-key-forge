import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Bot, User, Sparkles, FileCode, Paperclip, X, Copy, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { extractFirstLuaBlock, extractWebBlock } from "./luaParser";
import type { RInstance, StudioFile } from "./types";
import { uid } from "./utils";
import { useToast } from "@/hooks/use-toast";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface StudioChatProps {
  onApplyUI: (instances: RInstance[]) => void;
  onCreateFile: (file: StudioFile) => void;
  uiInstances: RInstance[];
}

const SYSTEM_HINT = `You are an expert UI/code engineer inside ULT Cloud's AI Studio. The user can preview your output live.

When the user wants a Roblox UI: output a complete, runnable Lua script using \`Instance.new\` with \`local\` declarations and explicit \`.Parent\` assignments. Always create a ScreenGui and parent everything under it. Use \`UDim2.new\`, \`UDim.new\`, \`Color3.fromRGB\`, \`Vector2.new\`, and \`Enum.\` values.

When the user wants web UI, output html / css / js fenced blocks separately so they can preview live.

ALWAYS wrap code in proper fenced markdown blocks with a language tag (\`\`\`lua, \`\`\`html, \`\`\`css, \`\`\`js, etc.) so the user can copy/download it. Keep replies tight — no yapping.`;

const langToExt = (lang: string): { ext: string; language: StudioFile["language"] } => {
  const l = (lang || "").toLowerCase();
  if (l === "lua" || l === "luau") return { ext: "lua", language: "lua" };
  if (l === "html") return { ext: "html", language: "html" };
  if (l === "css") return { ext: "css", language: "css" };
  if (l === "js" || l === "javascript") return { ext: "js", language: "javascript" };
  if (l === "ts" || l === "typescript") return { ext: "ts", language: "typescript" };
  if (l === "json") return { ext: "json", language: "json" };
  if (l === "md" || l === "markdown") return { ext: "md", language: "markdown" };
  return { ext: "txt", language: "lua" };
};

export const StudioChat = ({ onApplyUI, onCreateFile, uiInstances }: StudioChatProps) => {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; content: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const savedMsgIdxRef = useRef<Set<number>>(new Set());
  const { toast } = useToast();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const downloadText = useCallback((name: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const copyText = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard" });
  }, [toast]);

  // Auto-save fenced code blocks from a completed assistant message into Files.
  const autoSaveCodeBlocks = useCallback((markdown: string) => {
    const re = /```(\w+)?\s*\n([\s\S]*?)```/g;
    let m: RegExpExecArray | null;
    const stamp = Date.now();
    let i = 0;
    while ((m = re.exec(markdown))) {
      const rawLang = m[1] || "";
      const code = m[2].trim();
      if (!code) continue;
      const { ext, language } = langToExt(rawLang);
      onCreateFile({
        id: uid(),
        name: `ai-${stamp}-${++i}.${ext}`,
        language,
        content: code,
      });
    }
    return i;
  }, [onCreateFile]);

  const send = useCallback(async (text: string) => {
    if ((!text.trim() && attachments.length === 0) || loading) return;
    setInput("");
    const attachmentBlock = attachments.length
      ? attachments.map((a) => `### File: ${a.name}\n\`\`\`\n${a.content}\n\`\`\``).join("\n\n") + "\n\n"
      : "";
    const finalText = (attachmentBlock + text).trim();
    const userMsg: ChatMsg = { role: "user", content: finalText };
    setAttachments([]);
    const next = [...messages, userMsg, { role: "assistant" as const, content: "" }];
    setMessages(next);
    const assistantIdx = next.length - 1;
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: SYSTEM_HINT },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: finalText },
          ],
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* */ }
        throw new Error(msg);
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch { /* partial */ }
        }
      }

      // Auto-save code blocks once streaming finishes
      if (acc && !savedMsgIdxRef.current.has(assistantIdx)) {
        savedMsgIdxRef.current.add(assistantIdx);
        const count = autoSaveCodeBlocks(acc);
        if (count > 0) {
          toast({ title: `Saved ${count} code file${count > 1 ? "s" : ""}`, description: "Open the Code tab to view." });
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: "Error: failed to reach AI. Try again." };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }, [messages, loading, attachments, autoSaveCodeBlocks, toast]);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    const loaded: { name: string; content: string }[] = [];
    for (const f of files) {
      if (f.size > 1024 * 1024) continue;
      try {
        const text = await f.text();
        loaded.push({ name: f.name, content: text });
      } catch { /* skip */ }
    }
    if (loaded.length) setAttachments((prev) => [...prev, ...loaded]);
  }, []);

  // Custom code block renderer with copy + download
  const renderCodeBlock = (lang: string, code: string) => {
    const { ext } = langToExt(lang);
    const filename = `snippet-${Date.now()}.${ext}`;
    return (
      <div className="relative my-2 rounded-lg border border-border/50 overflow-hidden bg-muted/60">
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-foreground/5 border-b border-border/50">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">{lang || "code"}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => copyText(code)}
              className="h-6 px-2 rounded text-[10px] flex items-center gap-1 hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Copy code"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
            <button
              onClick={() => downloadText(filename, code)}
              className="h-6 px-2 rounded text-[10px] flex items-center gap-1 hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Download code"
            >
              <Download className="h-3 w-3" /> Download
            </button>
          </div>
        </div>
        <pre className="p-2.5 text-[11px] overflow-x-auto font-mono leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-3 py-2.5 border-b border-border flex items-center gap-2 shrink-0">
        <Sparkles className="h-4 w-4 text-white" />
        <span className="text-sm font-medium">AI Assistant</span>
        <span className="ml-auto text-[10px] text-muted-foreground">Code auto-saves to Files</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-12 space-y-2 px-4">
            <Bot className="h-10 w-10 mx-auto opacity-50" />
            <div className="text-sm">Ask me to build a Roblox UI, fix code, or create a webpage.</div>
            <div className="text-[11px] opacity-70">Every code block gets a Copy + Download button and auto-saves to your Files.</div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="text-sm">
            <div className="flex items-center gap-1.5 mb-1.5 text-muted-foreground">
              {m.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
              <span className="text-[10px] uppercase tracking-wide">{m.role}</span>
            </div>
            <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_p]:text-[13px] [&_ul]:text-[13px] [&_ol]:text-[13px] [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded [&_:not(pre)>code]:text-[12px]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "");
                    const codeStr = String(children).replace(/\n$/, "");
                    if (!inline && match) {
                      return renderCodeBlock(match[1], codeStr);
                    }
                    if (!inline) {
                      return renderCodeBlock("", codeStr);
                    }
                    return <code className={className} {...props}>{children}</code>;
                  },
                  pre({ children }: any) {
                    // The custom code renderer already wraps in <pre>, so unwrap markdown's outer <pre>
                    return <>{children}</>;
                  },
                }}
              >
                {m.content || (loading && i === messages.length - 1 ? "..." : "")}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-2.5 space-y-2 shrink-0">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((a, i) => (
              <div key={i} className="flex items-center gap-1 text-[11px] bg-muted rounded px-2 py-1">
                <FileCode className="h-3 w-3" />
                <span className="max-w-[120px] truncate">{a.name}</span>
                <button onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}>
                  <X className="h-3 w-3 opacity-60 hover:opacity-100" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".lua,.luau,.txt,.js,.ts,.tsx,.jsx,.json,.html,.css,.md,.py,text/*"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            size="icon"
            variant="outline"
            className="h-11 w-11 shrink-0"
            title="Attach files"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
            }}
            placeholder="Ask anything... e.g. 'Build a login UI in Roblox'"
            className="min-h-[44px] max-h-[140px] text-sm resize-none"
            rows={1}
          />
          <Button
            onClick={() => send(input)}
            disabled={loading || (!input.trim() && attachments.length === 0)}
            size="icon"
            className="h-11 w-11 shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};
