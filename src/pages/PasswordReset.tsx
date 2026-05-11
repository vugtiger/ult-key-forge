import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Sparkles, Loader2, KeyRound } from "lucide-react";
import CloudBackground from "@/components/CloudBackground";
import SnowEffect from "@/components/SnowEffect";
import { buildAppUrl } from "@/lib/site-url";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const PasswordReset = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hey! I'm here to help you reset your ULT CLOUD password. Just tell me your email address and I'll get a reset link sent over to you right away.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const extractEmail = (text: string): string | null => {
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
    const match = text.match(emailRegex);
    return match ? match[0] : null;
  };

  const sendResetEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: buildAppUrl("/update-password"),
    });
    return error;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Check if user provided an email
      const email = extractEmail(text);

      if (email && !emailSent) {
        // Send the reset email
        const error = await sendResetEmail(email);

        if (error) {
          const msg = (error.message || "").toLowerCase();
          const isRateLimit =
            msg.includes("rate limit") ||
            msg.includes("too many") ||
            (error as any).status === 429;

          const friendly = isRateLimit
            ? `You've requested too many password reset emails in a short time. For security reasons, please wait about 60 seconds before trying again. If you already received an email, check your inbox (and spam folder).`
            : `Hmm, I ran into an issue: "${error.message}". Could you double-check that email address and try again?`;

          const errorMsg: Message = { role: "assistant", content: friendly };
          setMessages([...newMessages, errorMsg]);

          // Treat rate-limit as "email already sent" so the user doesn't keep retrying
          if (isRateLimit) setEmailSent(true);
        } else {
          setEmailSent(true);
          const successMsg: Message = {
            role: "assistant",
            content: `Done! I've sent a password reset link to **${email}**. Check your inbox (and spam folder just in case). Click the link in the email to set your new password. Once you're done, you can head back to sign in!`,
          };
          setMessages([...newMessages, successMsg]);
        }
        setLoading(false);
        return;
      }

      // Static replies — AI chat requires authentication, which signed-out users don't have
      const reply: Message = {
        role: "assistant",
        content: emailSent
          ? "I've already sent your reset link! Check your inbox and spam folder. Click the link in the email to set a new password."
          : "Just type your email address (e.g. you@example.com) and I'll send the reset link right over.",
      };
      setMessages([...newMessages, reply]);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Sorry, I hit a snag. Could you try again?",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      <CloudBackground />
      <SnowEffect />

      <div className="relative z-10 w-full max-w-md px-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/auth")}
          className="mb-6 gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={18} />
          Back to Sign In
        </Button>

        <Card className="p-6 bg-card/50 backdrop-blur-xl border-border/30 rounded-2xl flex flex-col h-[520px]">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border/30">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-base">Password Reset</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-primary" />
                AI Assistant
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted/50 border border-border/40 rounded-bl-sm"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-medium text-primary">AI Assistant</span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted/50 border border-border/40 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                    <span className="text-[10px] font-medium text-primary">Thinking...</span>
                  </div>
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            {emailSent && (
              <div className="text-center py-2">
                <span className="text-xs text-muted-foreground bg-muted/30 px-3 py-1 rounded-full">
                  Reset email sent ✓
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="mt-4 pt-4 border-t border-border/30 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={emailSent ? "Any other questions?" : "Type your email address..."}
              disabled={loading}
              className="bg-background/50 border-border/50 focus:border-primary/50 rounded-xl text-sm"
            />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              size="icon"
              className="shrink-0 rounded-xl"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PasswordReset;
