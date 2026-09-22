import { useSearchParams, useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import CloudBackground from "@/components/CloudBackground";
import CloudLogo from "@/components/CloudLogo";
import { Button } from "@/components/ui/button";

const Blocked = () => {
  const [params] = useSearchParams();
  const ref = params.get("ref") || "";
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center px-4">
      <CloudBackground />
      <div className="relative z-10 w-full max-w-lg text-center">
        <div className="inline-flex items-center justify-center mb-6">
          <CloudLogo size={72} />
        </div>
        <div className="rounded-2xl border border-destructive/30 bg-card/70 backdrop-blur-2xl p-8">
          <ShieldAlert className="mx-auto text-destructive mb-4" size={48} />
          <h1 className="text-2xl font-bold mb-2">Unauthorized Access Blocked</h1>
          <p className="text-sm text-muted-foreground mb-4">
            You reached a protected delivery route directly. This action has been
            logged and your device, network and account have been added to the
            global ban list.
          </p>
          {ref && (
            <p className="text-xs text-muted-foreground/70 mb-6 break-all">
              Reference: <span className="font-mono">{ref}</span>
            </p>
          )}
          <Button onClick={() => navigate("/")} variant="secondary" className="rounded-xl">
            Back to Home
          </Button>
        </div>
        <p className="text-xs text-muted-foreground/60 mt-6">
          ULT LUA — Protected by ULT Fortress
        </p>
      </div>
    </div>
  );
};

export default Blocked;
