import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Bot, User, Shield, CheckCircle } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const PasswordReset = () => {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "verify" | "reset">("email");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const startVerification = async () => {
    if (!email) {
      toast({ title: "Error", description: "Please enter your email", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await supabase.functions.invoke('verify-account-owner', {
        body: { 
          email, 
          messages: [{ role: "user", content: "I want to reset my password. Please verify that I own this account." }]
        }
      });

      if (response.error) throw new Error(response.error.message);
      
      if (response.data.error) {
        toast({ title: "Error", description: response.data.error, variant: "destructive" });
        return;
      }

      setStep("verify");
      setMessages([
        { role: "assistant", content: response.data.response || "Hello! I'm here to verify that you're the owner of this account. I'll ask you a few questions about your account activity. Please answer as accurately as you can.\n\nFirst question: Have you created any key systems on this platform? If yes, can you tell me the name of any key system you created?" }
      ]);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await supabase.functions.invoke('verify-account-owner', {
        body: { 
          email, 
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        }
      });

      if (response.error) throw new Error(response.error.message);

      const assistantMessage: Message = { 
        role: "assistant", 
        content: response.data.response 
      };
      setMessages([...newMessages, assistantMessage]);

      if (response.data.verified) {
        toast({ title: "Verified!", description: "You have been verified as the account owner." });
        setStep("reset");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }

    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Directly update password via edge function
      const response = await supabase.functions.invoke('reset-password', {
        body: { email, newPassword }
      });

      if (response.error) throw new Error(response.error.message);
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }

      toast({ 
        title: "Success!", 
        description: "Your password has been updated. You can now sign in with your new password." 
      });
      navigate("/auth");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />

      <div className="relative z-10 w-full max-w-2xl px-4">
        <Button variant="ghost" onClick={() => navigate("/auth")} className="mb-6 gap-2">
          <ArrowLeft size={18} />
          Back to Sign In
        </Button>

        <Card className="p-8 cyber-border bg-card/50 backdrop-blur-xl">
          <div className="text-center mb-8">
            <Shield className="w-12 h-12 mx-auto mb-4 text-foreground" />
            <h1 className="text-3xl font-bold mb-2">Password Reset</h1>
            <p className="text-muted-foreground">
              {step === "email" && "Enter your email to start the verification process"}
              {step === "verify" && "Answer the questions to verify your identity"}
              {step === "reset" && "You've been verified! Reset your password below"}
            </p>
          </div>

          {step === "email" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-input border-border"
                />
              </div>
              <Button onClick={startVerification} disabled={loading} className="w-full cyber-glow">
                {loading ? "Starting..." : "Start Verification"}
              </Button>
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-4">
              <div className="h-80 overflow-y-auto space-y-4 p-4 rounded-lg bg-input/30 border border-border">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center flex-shrink-0">
                        <Bot size={16} />
                      </div>
                    )}
                    <div className={`max-w-[80%] p-3 rounded-lg ${
                      msg.role === "user" 
                        ? "bg-foreground/20 text-foreground" 
                        : "bg-card border border-border"
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-foreground/20 flex items-center justify-center flex-shrink-0">
                        <User size={16} />
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center">
                      <Bot size={16} />
                    </div>
                    <div className="bg-card border border-border p-3 rounded-lg">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" />
                        <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                        <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Type your answer..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  disabled={loading}
                  className="bg-input border-border"
                />
                <Button onClick={sendMessage} disabled={loading || !input.trim()} className="cyber-glow">
                  <Send size={18} />
                </Button>
              </div>
            </div>
          )}

          {step === "reset" && (
            <div className="space-y-6">
              <div className="flex items-center justify-center gap-2 text-green-500 mb-4">
                <CheckCircle size={24} />
                <span className="font-semibold">Identity Verified</span>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-input border-border"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-input border-border"
                />
              </div>
              
              <Button onClick={handlePasswordReset} disabled={loading} className="w-full cyber-glow">
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PasswordReset;
