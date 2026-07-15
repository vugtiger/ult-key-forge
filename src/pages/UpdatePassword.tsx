import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Shield, Eye, EyeOff, CheckCircle, KeyRound } from "lucide-react";
import CloudBackground from "@/components/CloudBackground";
import SnowEffect from "@/components/SnowEffect";
import { isRecoveryLinkPayload } from "@/lib/site-url";

const UpdatePassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errorDescription = hashParams.get("error_description");
    const errorCode = hashParams.get("error_code");

    if (errorCode || errorDescription) {
      toast({
        title: "Reset Link Expired",
        description: errorDescription || "Please request a fresh password reset email.",
        variant: "destructive",
      });
      navigate("/password-reset", { replace: true });
      return;
    }

    let recoveryDetected = false;
    let active = true;
    const startedFromRecoveryLink = isRecoveryLinkPayload();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === 'PASSWORD_RECOVERY') {
        recoveryDetected = true;
        setReady(true);
      }
    });

    const checkSession = async () => {
      if (!startedFromRecoveryLink) {
        toast({
          title: "Invalid Reset Link",
          description: "Please use the reset link from your email.",
          variant: "destructive",
        });
        navigate("/password-reset", { replace: true });
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 900));

      if (!active || recoveryDetected) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setReady(true);
      } else {
        toast({
          title: "Invalid or Expired Link",
          description: "Please request a new password reset link.",
          variant: "destructive",
        });
        navigate("/password-reset", { replace: true });
      }
    };

    checkSession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate, toast]);

  const handleUpdatePassword = async () => {
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
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setSuccess(true);
      toast({ 
        title: "Password Updated!", 
        description: "Your password has been changed. Please sign in with your new password." 
      });

      // Sign out and redirect to login
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate("/auth");
      }, 2500);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!ready && !success) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
        <CloudBackground />
        <SnowEffect />
        <Card className="relative z-10 p-8 bg-card/50 backdrop-blur-xl border-border/30 rounded-2xl text-center max-w-md">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-card border border-border/50 flex items-center justify-center">
            <KeyRound className="w-7 h-7 text-foreground animate-pulse" />
          </div>
          <h1 className="text-xl font-bold mb-2">Verifying Reset Link...</h1>
          <p className="text-sm text-muted-foreground">Please wait while we verify your password reset link.</p>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
        <CloudBackground />
        <SnowEffect />

        <Card className="relative z-10 p-8 bg-card/50 backdrop-blur-xl border-border/30 rounded-2xl text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/15 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Password Updated!</h1>
          <p className="text-muted-foreground">Your password has been changed. Redirecting to sign in...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      <CloudBackground />
      <SnowEffect />

      <div className="relative z-10 w-full max-w-md px-4">
        <Button variant="ghost" onClick={() => navigate("/auth")} className="mb-6 gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
          Back to Sign In
        </Button>

        <Card className="p-8 bg-card/50 backdrop-blur-xl border-border/30 rounded-2xl">
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-card border border-border/50 flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-foreground" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Set New Password</h1>
            <p className="text-sm text-muted-foreground">
              Enter your new password below. Your old password will no longer work.
            </p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm text-muted-foreground">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-background/50 border-border/50 focus:border-primary/50 pr-10 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm text-muted-foreground">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUpdatePassword()}
                className="bg-background/50 border-border/50 focus:border-primary/50 rounded-xl"
              />
            </div>

            <Button onClick={handleUpdatePassword} disabled={loading} className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-xl">
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default UpdatePassword;
