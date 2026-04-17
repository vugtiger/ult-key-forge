import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Send, Loader2, Sparkles, Code, Globe, HelpCircle, Trash2,
  MessageSquare, Zap, Bot, Paperclip, X, Image as ImageIcon, Film, FileText,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import TabHelpSection from "@/components/onboarding/TabHelpSection";
import { aiAssistantHelp } from "@/components/onboarding/helpContent";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Attachment = { url: string; name: string; mime: string };
type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
interface Message {
  role: "user" | "assistant";
  content: string;          // plain text rendered
  attachments?: Attachment[]; // shown above text
}

const suggestedPrompts = [
  { icon: <Code className="h-4 w-4" />, text: "Write a complete kill-all script for Roblox" },
  { icon: <Globe className="h-4 w-4" />, text: "Build a modern landing page in React + Tailwind" },
  { icon: <HelpCircle className="h-4 w-4" />, text: "Fix this Lua error: attempt to call a nil value" },
  { icon: <Zap className="h-4 w-4" />, text: "Optimize my Roblox script for performance" },
];

const isImage = (m: string) => m.startsWith("image/");
const isVideo = (m: string) => m.startsWith("video/");

const AIAssistant = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // Load history on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("ai_chat_messages")
        .select("role, content")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (data?.length) {
        setMessages(data.map((m: any) => ({
          role: m.role,
          content: m.content?.text ?? "",
          attachments: m.content?.attachments ?? [],
        })));
      }
    })();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const persist = async (role: "user" | "assistant", content: string, attachments?: Attachment[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("ai_chat_messages").insert({
      user_id: user.id, role, content: { text: content, attachments: attachments ?? [] },
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in required");
      const uploaded: Attachment[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 50 * 1024 * 1024) {
          toast({ title: "Too large", description: `${file.name} exceeds 50MB`, variant: "destructive" });
          continue;
        }
        const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error } = await supabase.storage.from("ai-uploads").upload(path, file, {
          contentType: file.type, upsert: false,
        });
        if (error) throw error;
        const { data } = supabase.storage.from("ai-uploads").getPublicUrl(path);
        uploaded.push({ url: data.publicUrl, name: file.name, mime: file.type || "application/octet-stream" });
      }
      setPending((p) => [...p, ...uploaded]);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const buildApiContent = (text: string, attachments: Attachment[]): string | Part[] => {
    if (!attachments.length) return text;
    const parts: Part[] = [];
    if (text.trim()) parts.push({ type: "text", text });
    for (const a of attachments) {
      if (isImage(a.mime)) {
        parts.push({ type: "image_url", image_url: { url: a.url } });
      } else {
        parts.push({
          type: "text",
          text: `[Attached ${isVideo(a.mime) ? "video" : "file"}: ${a.name} (${a.mime})] URL: ${a.url}`,
        });
      }
    }
    return parts.length ? parts : text;
  };

  const handleSendMessage = async (override?: string) => {
    const textToSend = (override ?? input).trim();
    if ((!textToSend && pending.length === 0) || loading) return;

    const attachments = pending;
    setPending([]);
    setInput("");
    const userMsg: Message = { role: "user", content: textToSend, attachments };
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    setLoading(true);
    persist("user", textToSend, attachments);

    try {
      // Build API messages from full history
      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: buildApiContent(m.content, m.attachments ?? []),
      }));

      const { data: { session } } = await supabase.auth.getSession();
      const url = `https://iyfvpnjrghsownkpazec.supabase.co/functions/v1/ai-chat`;
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: assistantText };
                return next;
              });
            }
          } catch {}
        }
      }

      if (assistantText) persist("assistant", assistantText);
    } catch (err: any) {
      const msg = err?.name === "AbortError" ? "Stopped." : (err?.message || "Failed to get AI response");
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: `⚠️ ${msg}` };
        return next;
      });
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = useCallback(async () => {
    setMessages([]);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("ai_chat_messages").delete().eq("user_id", user.id);
  }, []);

  const stop = () => abortRef.current?.abort();

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/30 shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.5)]">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2 flex-wrap">
                AI Coding Agent
                <Badge variant="outline" className="text-xs">Streaming • Multimodal</Badge>
              </h1>
              <p className="text-muted-foreground text-sm">
                Drops complete code instantly — Lua, web, debugging, image/video/file analysis.
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearChat} className="gap-2">
              <Trash2 className="h-4 w-4" />
              <span>Clear</span>
            </Button>
          )}
        </div>

        <TabHelpSection {...aiAssistantHelp} />

        <Card className="cyber-border bg-card/50 backdrop-blur-xl flex flex-col overflow-hidden h-[calc(100vh-16rem)] min-h-[600px]">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="p-4 rounded-full bg-primary/10 mb-6 border border-primary/20">
                  <Bot className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">What are we building?</h2>
                <p className="text-muted-foreground mb-8 max-w-md">
                  Drop a prompt, paste a screenshot, or upload a video — I'll just do it.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                  {suggestedPrompts.map((prompt, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="justify-start gap-3 h-auto py-3 px-4 text-left hover:bg-primary/10 hover:border-primary/30"
                      onClick={() => handleSendMessage(prompt.text)}
                    >
                      <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
                        {prompt.icon}
                      </div>
                      <span className="text-sm whitespace-normal break-words flex-1">{prompt.text}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[90%] rounded-2xl p-4 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.5)]"
                          : "bg-muted/50 border border-border/50 rounded-bl-md"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/30">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="text-xs font-medium text-primary">AI Agent</span>
                        </div>
                      )}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {message.attachments.map((a, i) => (
                            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                               className="block rounded-lg overflow-hidden border border-border/50 bg-background/40 max-w-[180px]">
                              {isImage(a.mime) ? (
                                <img src={a.url} alt={a.name} className="w-full h-24 object-cover" />
                              ) : isVideo(a.mime) ? (
                                <video src={a.url} className="w-full h-24 object-cover" muted />
                              ) : (
                                <div className="p-3 flex items-center gap-2 text-xs">
                                  <FileText className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{a.name}</span>
                                </div>
                              )}
                            </a>
                          ))}
                        </div>
                      )}
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-muted/40 prose-pre:border prose-pre:border-border/40 prose-pre:rounded-lg prose-code:before:content-none prose-code:after:content-none break-words">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content || "▍"}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed break-words">
                          {message.content}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && messages[messages.length - 1]?.content === "" && (
                  <div className="flex justify-start">
                    <div className="bg-muted/50 border border-border/50 rounded-2xl rounded-bl-md p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <div className="p-4 border-t border-border/50 bg-background/50">
            {pending.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {pending.map((a, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden border border-border/50 bg-background/40">
                    {isImage(a.mime) ? (
                      <img src={a.url} alt={a.name} className="w-16 h-16 object-cover" />
                    ) : isVideo(a.mime) ? (
                      <div className="w-16 h-16 flex items-center justify-center"><Film className="h-5 w-5" /></div>
                    ) : (
                      <div className="w-16 h-16 flex items-center justify-center"><FileText className="h-5 w-5" /></div>
                    )}
                    <button
                      onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                      className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                    >
                      <X className="h-3 w-3" />
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
                accept="image/*,video/*,.pdf,.txt,.md,.json,.lua,.js,.ts,.tsx,.jsx,.html,.css"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-[56px] w-[56px] shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Attach images, videos, files"
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
              </Button>
              <div className="flex-1 relative">
                <Textarea
                  placeholder="Ask anything — paste code, upload screenshots, drop a video..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="min-h-[56px] max-h-[240px] resize-none pr-12 bg-background/50 border-border/50 focus:border-primary/50"
                  rows={1}
                />
              </div>
              {loading ? (
                <Button onClick={stop} size="lg" variant="destructive" className="px-6 h-[56px] shrink-0">
                  <X className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!input.trim() && pending.length === 0}
                  size="lg"
                  className="px-6 h-[56px] shrink-0 cyber-glow"
                >
                  <Send className="h-5 w-5" />
                </Button>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground gap-2 flex-wrap">
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {messages.length} messages
              </span>
              <span className="flex items-center gap-1">
                <ImageIcon className="h-3 w-3" /> Images
                <span className="mx-1">·</span>
                <Film className="h-3 w-3" /> Video
                <span className="mx-1">·</span>
                <FileText className="h-3 w-3" /> Files
              </span>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AIAssistant;
