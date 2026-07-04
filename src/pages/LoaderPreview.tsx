import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Copy, ArrowLeft, ShieldCheck, ShieldAlert, Loader2, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CloudLogo from "@/components/CloudLogo";

interface Meta {
  slug: string;
  title: string | null;
  created_at: string;
  protection_enabled: boolean;
  hide_code?: boolean;
  online: boolean;
}

const LoaderPreview = () => {
  const { slug } = useParams<{ slug: string }>();
  const nav = useNavigate();
  const { toast } = useToast();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound">("loading");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const rawLoader = slug ? buildLoaderUrl(slug) : "";
  const loadstring = buildLoadstring(slug || "");

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/paste-meta?slug=${slug}`);
        if (!res.ok) throw new Error("not found");
        setMeta(await res.json());
        setState("ready");
      } catch {
        setState("notfound");
      }
    })();
  }, [slug, supabaseUrl]);

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast({ title: "Copied" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(1000px_500px_at_50%_-10%,hsl(272_90%_35%/0.35),transparent_60%)] pointer-events-none" />
      <div className="w-full max-w-lg relative">
        <div className="depth-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <CloudLogo size={40} />
            <div className="leading-tight">
              <div className="text-[10px] tracking-[0.25em] text-muted-foreground">ULT LOADER</div>
              <div className="text-lg font-bold">Script Endpoint</div>
            </div>
          </div>

          {state === "loading" && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Resolving…
            </div>
          )}

          {state === "notfound" && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5" />
                <span className="font-semibold">Unauthorized / not found</span>
              </div>
              <p className="text-sm text-muted-foreground">
                This paste doesn't exist or you're not permitted to view it from a browser.
                Bypassing this page won't work — the loader only serves valid Roblox executors with a signed session.
              </p>
              <Button onClick={() => nav("/")} variant="outline" className="w-full gap-2">
                <Home className="h-4 w-4" /> Go home
              </Button>
            </div>
          )}

          {state === "ready" && meta && (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-xs text-emerald-400">Online</span>
                  {meta.protection_enabled && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
                      <ShieldCheck className="h-3 w-3" /> Protected
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.2em] text-muted-foreground">NAME</div>
                  <div className="text-lg font-semibold">{meta.title || "Untitled paste"}</div>
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.2em] text-muted-foreground">CREATED</div>
                  <div className="text-sm">{new Date(meta.created_at).toLocaleString()}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] tracking-[0.2em] text-muted-foreground">LOADSTRING</div>
                <div className="relative">
                  <pre className="text-[11px] bg-muted/40 border border-border/60 rounded-lg p-3 pr-12 overflow-x-auto text-foreground/90">
                    {loadstring}
                  </pre>
                  <Button size="icon" variant="ghost" className="absolute top-1.5 right-1.5 h-7 w-7"
                    onClick={() => copy(loadstring)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Paste into your executor. Direct browser access to the raw endpoint is monitored.
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={() => nav("/")}>
                  <ArrowLeft className="h-4 w-4" /> Back home
                </Button>
                <Button className="flex-1 gap-2" onClick={() => copy(loadstring)}>
                  <Copy className="h-4 w-4" /> Copy loader
                </Button>
              </div>
            </>
          )}
        </div>
        <p className="text-center text-[10px] text-muted-foreground/60 mt-4 tracking-wider">
          ULT CLOUD · script protection
        </p>
      </div>
    </div>
  );
};

export default LoaderPreview;
