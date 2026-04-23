import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Bot, User, Sparkles, Code2, FileCode, Layers } from "lucide-react";
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
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setInput("");
    const userMsg: ChatMsg = { role: "user", content: text.trim() };
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
            { role: "user", content: text.trim() },
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
  }, [messages, loading]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && m.content);
  const luaBlock = lastAssistant ? extractFirstLuaBlock(lastAssistant.content) : null;
  const webBlock = lastAssistant ? extractWebBlock(lastAssistant.content) : null;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-blue-500" />
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

      <div className="border-t border-border p-2 flex gap-2">
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
        <Button onClick={() => send(input)} disabled={loading || !input.trim()} size="icon" className="h-10 w-10 shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};
