import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail, Lock, Eye, EyeOff, CheckCircle, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const AccountInfo = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
          <p className="text-sm text-muted-foreground">
            For security, your password cannot be displayed. Use the button below to change it.
          </p>
          <Button 
            variant="outline" 
            size="sm"
            className="gap-2"
            onClick={() => navigate("/password-reset")}
          >
            <KeyRound className="h-4 w-4" />
            Change Password
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AccountInfo;
