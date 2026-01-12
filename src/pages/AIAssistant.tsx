import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2, Sparkles, Code, Globe, HelpCircle, Trash2, MessageSquare, Zap, Bot } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const suggestedPrompts = [
  { icon: <Code className="h-4 w-4" />, text: "Create a kill all script for Roblox" },
  { icon: <Globe className="h-4 w-4" />, text: "Build me a modern landing page" },
  { icon: <HelpCircle className="h-4 w-4" />, text: "Explain how key systems work" },
  { icon: <Zap className="h-4 w-4" />, text: "Optimize my Roblox script for performance" },
];

const AIAssistant = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: textToSend }]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: [...messages, { role: "user", content: textToSend }] },
      });

      if (error) throw error;

      if (data?.response) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.response },
        ]);
        
        // Log activity for password reset verification
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('user_activity').insert({
            user_id: user.id,
            activity_type: 'ai_chat',
            activity_data: { topic: textToSend.slice(0, 50) }
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to get AI response",
        variant: "destructive",
      });
      
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
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

  const clearChat = () => {
    setMessages([]);
  };

  const formatMessage = (content: string) => {
    // Handle code blocks
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const codeContent = part.slice(3, -3);
        const firstNewline = codeContent.indexOf('\n');
        const language = firstNewline > 0 ? codeContent.slice(0, firstNewline) : '';
        const code = firstNewline > 0 ? codeContent.slice(firstNewline + 1) : codeContent;
        
        return (
          <div key={index} className="my-3 rounded-lg overflow-hidden border border-border/50">
            {language && (
              <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b border-border/50">
                {language}
              </div>
            )}
            <pre className="p-3 bg-muted/30 overflow-x-auto">
              <code className="text-sm font-mono">{code}</code>
            </pre>
          </div>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto h-[calc(100vh-10rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                AI Assistant
                <Badge variant="outline" className="text-xs">Powered by Gemini</Badge>
              </h1>
              <p className="text-muted-foreground">
                Your intelligent coding companion for Roblox scripts and web development
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearChat} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Clear Chat
            </Button>
          )}
        </div>

        {/* Main Chat Area */}
        <Card className="flex-1 cyber-border bg-card/50 backdrop-blur-xl flex flex-col overflow-hidden">
          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              // Empty State with Suggestions
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="p-4 rounded-full bg-primary/10 mb-6">
                  <Bot className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">How can I help you today?</h2>
                <p className="text-muted-foreground mb-8 max-w-md">
                  I can help you with Roblox Lua scripting, web development, debugging, and explaining code concepts.
                </p>
                
                {/* Suggested Prompts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                  {suggestedPrompts.map((prompt, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="justify-start gap-3 h-auto py-3 px-4 text-left hover:bg-primary/10 hover:border-primary/30 transition-all"
                      onClick={() => handleSendMessage(prompt.text)}
                    >
                      <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                        {prompt.icon}
                      </div>
                      <span className="text-sm">{prompt.text}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              // Messages
              <>
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted/50 border border-border/50 rounded-bl-md"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/30">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="text-xs font-medium text-primary">AI Assistant</span>
                        </div>
                      )}
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.role === "assistant" ? formatMessage(message.content) : message.content}
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-muted/50 border border-border/50 rounded-2xl rounded-bl-md p-4">
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/30">
                        <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                        <span className="text-xs font-medium text-primary">AI is thinking...</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-border/50 bg-background/50">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Textarea
                  placeholder="Ask me anything... (Shift+Enter for new line)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="min-h-[56px] max-h-[200px] resize-none pr-12 bg-background/50 border-border/50 focus:border-primary/50"
                  rows={1}
                />
                <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted/50 text-[10px]">Enter</kbd>
                </div>
              </div>
              <Button
                onClick={() => handleSendMessage()}
                disabled={loading || !input.trim()}
                size="lg"
                className="px-6 cyber-glow"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {messages.length} messages
                </span>
              </div>
              <span>Powered by Lovable AI • Gemini 2.5 Flash</span>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AIAssistant;
