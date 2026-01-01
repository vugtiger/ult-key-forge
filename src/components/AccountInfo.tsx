import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const AccountInfo = () => {
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccountInfo();
  }, []);

  const fetchAccountInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setEmail(user.email || "");
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <Card className="p-6 cyber-border bg-card/50 backdrop-blur-xl">
        <p className="text-muted-foreground">Loading account info...</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 cyber-border bg-card/50 backdrop-blur-xl">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Account Information
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Address
            <span className="text-xs text-muted-foreground">(cannot be changed)</span>
          </Label>
          <div className="flex items-center gap-2">
            <Input 
              value={email} 
              readOnly 
              className="bg-muted/50"
            />
            <div className="flex items-center gap-1 text-green-400 text-sm">
              <CheckCircle className="h-4 w-4" />
              <span>Verified</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Password
          </Label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input 
                type={showPassword ? "text" : "password"}
                value="••••••••••••"
                readOnly 
                className="bg-muted/50 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Click the eye icon to view/hide your password placeholder
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AccountInfo;
