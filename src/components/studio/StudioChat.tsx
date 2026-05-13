import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Bot, User, Sparkles, Code2, FileCode, Layers, Paperclip, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { extractFirstLuaBlock, extractWebBlock, parseLuaUI } from "./luaParser";
import type { RInstance, StudioFile } from "./types";
import { uid } from "./utils";

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

When the user wants a Roblox UI: output a complete, runnable Lua script using \`Instance.new\` with \`local\` declarations and explicit \`.Parent\` assignments. Always create a ScreenGui and parent everything under it. Use \`UDim2.new\`, \`UDim.new\`, \`Color3.fromRGB\`, \`Vector2.new\`, and \`Enum.\` values. Do NOT explain — output the lua block first, then a one-line note.

When the user wants web UI, output html / css / js fenced blocks separately so they can preview live.

Keep responses tight. No yapping.`;

export const StudioChat = ({ onApplyUI, onCreateFile, uiInstances }: StudioChatProps) => {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; content: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

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

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

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
    } catch (err) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: "Error: failed to reach AI. Try again." };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }, [messages, loading, attachments]);

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

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && m.content);
  const luaBlock = lastAssistant ? extractFirstLuaBlock(lastAssistant.content) : null;
  const webBlock = lastAssistant ? extractWebBlock(lastAssistant.content) : null;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-white" />
        <span className="text-sm font-medium">AI Assistant</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8 space-y-2">
            <Bot className="h-8 w-8 mx-auto opacity-50" />
            <div>Ask me to build a Roblox UI, fix code, or create a webpage.</div>
            <div className="text-[10px] opacity-70">Lua UI output auto-renders in the Designer tab.</div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="text-xs">
            <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
              {m.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
              <span className="text-[10px] uppercase tracking-wide">{m.role}</span>
            </div>
            <div className="prose prose-invert prose-xs max-w-none [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded [&_pre]:text-[11px] [&_pre]:overflow-x-auto [&_code]:text-[11px] [&_p]:my-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || (loading && i === messages.length - 1 ? "..." : "")}</ReactMarkdown>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {(luaBlock || webBlock) && !loading && (
        <div className="border-t border-border p-2 space-y-1 bg-muted/30">
          {luaBlock && (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs justify-start gap-2"
              onClick={() => {
                const parsed = parseLuaUI(luaBlock);
                if (parsed) onApplyUI(parsed);
                onCreateFile({ id: uid(), name: `script-${Date.now()}.lua`, language: "lua", content: luaBlock });
              }}
            >
              <Layers className="h-3 w-3" /> Send Lua to UI Designer + new file
            </Button>
          )}
          {webBlock?.html && (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs justify-start gap-2"
              onClick={() => onCreateFile({ id: uid(), name: `page-${Date.now()}.html`, language: "html", content: webBlock.html })}
            >
              <Code2 className="h-3 w-3" /> New HTML file
            </Button>
          )}
          {webBlock?.css && (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs justify-start gap-2"
              onClick={() => onCreateFile({ id: uid(), name: `style-${Date.now()}.css`, language: "css", content: webBlock.css })}
            >
              <FileCode className="h-3 w-3" /> New CSS file
            </Button>
          )}
          {webBlock?.js && (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs justify-start gap-2"
              onClick={() => onCreateFile({ id: uid(), name: `script-${Date.now()}.js`, language: "javascript", content: webBlock.js })}
            >
              <FileCode className="h-3 w-3" /> New JS file
            </Button>
          )}
        </div>
      )}

      <div className="border-t border-border p-2 space-y-2">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((a, i) => (
              <div key={i} className="flex items-center gap-1 text-[10px] bg-muted rounded px-2 py-1">
                <FileCode className="h-3 w-3" />
                <span className="max-w-[120px] truncate">{a.name}</span>
                <button onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}>
                  <X className="h-3 w-3 opacity-60 hover:opacity-100" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
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
            className="h-10 w-10 shrink-0"
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
            placeholder="Build a login UI in Roblox..."
            className="min-h-[40px] max-h-[120px] text-xs resize-none"
            rows={1}
          />
          <Button onClick={() => send(input)} disabled={loading || (!input.trim() && attachments.length === 0)} size="icon" className="h-10 w-10 shrink-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};
