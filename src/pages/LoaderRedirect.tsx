import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getLoadstring } from "@/lib/loader-url";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import CloudBackground from "@/components/CloudBackground";
import { ArrowLeft, Copy, Check, ShieldCheck, Lock, Fingerprint, Radar } from "lucide-react";


const LoaderRedirect = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(Boolean(data.session)));
  }, []);

  const loadstring = slug ? getLoadstring(slug) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(loadstring);
      setCopied(true);
      toast({ title: "Copied", description: "Loadstring copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Select the text and copy manually", variant: "destructive" });
    }
  };

  const pillars = [
    { icon: Lock, title: "Nothing is served in plain text", text: "Every delivery is encrypted and single-use. What you fetch once is never valid again." },
    { icon: Fingerprint, title: "The request is bound to you", text: "Session, device and network fingerprints are tied together before a single line is released." },
    { icon: Radar, title: "Tampering answers back", text: "Hooked functions, dumps and relays are recognised on the spot and the session is dropped." },
    { icon: ShieldCheck, title: "One strike is permanent", text: "Unauthorized entry points are watched. Touch one and every identifier you own is retired for good." },
  ];

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden px-4 py-10 md:py-16">
      <CloudBackground />
      <div className="relative z-10 mx-auto w-full max-w-3xl space-y-6">

        <Button variant="ghost" onClick={() => navigate(loggedIn ? "/dashboard" : "/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to {loggedIn ? "dashboard" : "homepage"}
        </Button>

        <Card className="glass-card border-border/50">
          <CardHeader className="space-y-2">
            <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wider">
              Protected script
            </Badge>
            <CardTitle className="text-2xl md:text-3xl">Loadstring</CardTitle>
            <p className="text-sm text-muted-foreground">
              This is the official link for this script. Copy it and run it in your executor — nothing else is needed.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <pre className="overflow-x-auto rounded-xl border border-border/50 bg-muted/40 p-4 text-xs md:text-sm">
              <code className="break-all whitespace-pre-wrap">{loadstring || "Invalid script link."}</code>
            </pre>
            <Button onClick={copy} disabled={!slug} className="w-full gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy loadstring"}
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Why bypassing this is a bad afternoon</CardTitle>
            <p className="text-sm text-muted-foreground">
              A short version — the details stay ours.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {pillars.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border border-border/40 bg-background/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">{title}</h3>
                </div>
                <p className="text-xs text-muted-foreground">{text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default LoaderRedirect;
