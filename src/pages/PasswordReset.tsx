import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, KeyRound, Mail, Eye, EyeOff, CheckCircle } from "lucide-react";
import CloudBackground from "@/components/CloudBackground";
import SnowEffect from "@/components/SnowEffect";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Step = "email" | "code" | "password" | "success";

const PasswordReset = () => {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSendCode = async () => {
    if (!email) {
      toast({ title: "Error", description: "Please enter your email", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setStep("code");
      toast({ title: "Code Sent!", description: "Check your email for the 6-digit code." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (otpCode.length !== 6) {
      toast({ title: "Error", description: "Please enter the full 6-digit code", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "recovery",
      });
      if (error) throw error;
      setStep("password");
      toast({ title: "Code Verified!", description: "Now set your new password." });
    } catch (error: any) {
      toast({ title: "Invalid Code", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setStep("success");
      toast({ title: "Password Updated!", description: "Your password has been changed successfully." });
      // Sign out and redirect
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

  const renderStep = () => {
    switch (step) {
      case "email":
        return (
          <>
            <div className="text-center mb-8">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-card border border-border/50 flex items-center justify-center">
                <KeyRound className="w-7 h-7 text-foreground" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Password Reset</h1>
              <p className="text-muted-foreground text-sm">Enter your email to receive a verification code</p>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-muted-foreground">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                  className="bg-background/50 border-border/50 focus:border-primary/50 rounded-xl"
                />
              </div>
              <Button onClick={handleSendCode} disabled={loading} className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-xl">
                {loading ? "Sending..." : "Send Verification Code"}
              </Button>
            </div>
          </>
        );

      case "code":
        return (
          <>
            <div className="text-center mb-8">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-card border border-border/50 flex items-center justify-center">
                <Mail className="w-7 h-7 text-foreground" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Enter Verification Code</h1>
              <p className="text-muted-foreground text-sm">
                We sent a 6-digit code to <span className="text-foreground font-medium">{email}</span>
              </p>
            </div>
            <div className="space-y-5">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button onClick={handleVerifyCode} disabled={loading || otpCode.length !== 6} className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-xl">
                {loading ? "Verifying..." : "Verify Code"}
              </Button>
              <div className="text-center space-y-2">
                <button onClick={handleSendCode} disabled={loading} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Didn't get the code? Resend
                </button>
                <button onClick={() => { setStep("email"); setOtpCode(""); }} className="text-sm text-muted-foreground hover:text-primary transition-colors block w-full">
                  Try a different email
                </button>
              </div>
            </div>
          </>
        );

      case "password":
        return (
          <>
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
          </>
        );

      case "success":
        return (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Password Updated!</h1>
            <p className="text-muted-foreground">Your password has been changed. Redirecting to sign in...</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      <CloudBackground />
      <SnowEffect />

      <div className="relative z-10 w-full max-w-md px-4">
        {step !== "success" && (
          <Button variant="ghost" onClick={() => navigate("/auth")} className="mb-6 gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft size={18} />
            Back to Sign In
          </Button>
        )}

        <Card className="p-8 bg-card/50 backdrop-blur-xl border-border/30 rounded-2xl">
          {renderStep()}
        </Card>
      </div>
    </div>
  );
};

export default PasswordReset;
