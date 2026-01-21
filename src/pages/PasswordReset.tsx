import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Shield, Mail } from "lucide-react";

const PasswordReset = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSendResetEmail = async () => {
    if (!email) {
      toast({ title: "Error", description: "Please enter your email", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) throw error;

      setEmailSent(true);
      toast({ 
        title: "Email Sent!", 
        description: "Check your inbox for the password reset link." 
      });
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

      <div className="relative z-10 w-full max-w-md px-4">
        <Button variant="ghost" onClick={() => navigate("/auth")} className="mb-6 gap-2">
          <ArrowLeft size={18} />
          Back to Sign In
        </Button>

        <Card className="p-8 cyber-border bg-card/50 backdrop-blur-xl">
          <div className="text-center mb-8">
            <Shield className="w-12 h-12 mx-auto mb-4 text-foreground" />
            <h1 className="text-3xl font-bold mb-2">Password Reset</h1>
            <p className="text-muted-foreground">
              {emailSent 
                ? "Check your email for the reset link" 
                : "Enter your email to receive a password reset link"}
            </p>
          </div>

          {!emailSent ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendResetEmail()}
                  className="bg-input border-border"
                />
              </div>
              <Button onClick={handleSendResetEmail} disabled={loading} className="w-full cyber-glow">
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </div>
          ) : (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                <Mail className="w-8 h-8 text-green-500" />
              </div>
              <div className="space-y-2">
                <p className="text-foreground font-medium">Reset link sent to:</p>
                <p className="text-muted-foreground">{email}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Click the link in your email to reset your password. The link will expire in 1 hour.
              </p>
              <Button 
                variant="outline" 
                onClick={() => setEmailSent(false)} 
                className="w-full"
              >
                Try a different email
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PasswordReset;
