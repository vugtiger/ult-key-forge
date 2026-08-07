import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail, Lock, CheckCircle, KeyRound, MessageSquare, BookOpen, Shield, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const AccountInfo = () => {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<{ username: string | null; discord_username: string | null; discord_user_id: string | null; created_at: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAccountInfo();
  }, []);

  const fetchAccountInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setEmail(user.email || "");
      const { data } = await supabase
        .from("profiles")
        .select("username, discord_username, discord_user_id, created_at")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(data);
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
            <div className="flex items-center gap-1 text-primary text-sm">
              <CheckCircle className="h-4 w-4" />
              <span>Verified</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-border/50 pt-4">
          <Label className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Discord profile
          </Label>
          <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{profile?.discord_username || "Not linked"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {profile?.discord_user_id ? `Discord ID ${profile.discord_user_id}` : "Use the Discord bot /login command to link your account."}
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href="https://discord.gg/J8PfcmRrmx" target="_blank" rel="noopener noreferrer">
                Open server <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>

        <div className="space-y-3 border-t border-border/50 pt-4">
          <Label className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Owner documentary
          </Label>
          <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">Why ULT CLOUD exists</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">ULT CLOUD began as an owner-built answer to scattered paste links, fragile key systems, and missing execution visibility. It keeps Lua delivery, access controls, device locks, and history together without charging creators.</p>
              </div>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">The platform remains free forever. Administration is isolated to the owner account, while every creator keeps authority over only their own scripts, keys, device rules, and access records.</p>
            {profile?.created_at && <p className="text-[11px] text-muted-foreground">Member since {new Date(profile.created_at).toLocaleDateString()}</p>}
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
