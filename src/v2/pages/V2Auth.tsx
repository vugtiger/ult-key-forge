import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Shield, ArrowLeft } from "lucide-react";
import { v2SignIn, v2SignUp } from "../lib/v2Auth";
import { supabase } from "@/integrations/supabase/client";
import "../styles/v2.css";

const V2Auth = () => {
  const [params] = useSearchParams();
  const [isSignup, setIsSignup] = useState(params.get("mode") === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: profile } = await supabase.from("v2_profiles").select("id").eq("id", session.user.id).maybeSingle();
      if (profile) navigate("/v2/dashboard");
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isSignup) {
        await v2SignUp(email, password, username || email.split("@")[0]);
      } else {
        await v2SignIn(email, password);
      }
      navigate("/v2/dashboard");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="v2-root flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 v2-grid-bg opacity-30 pointer-events-none" />
      <div className="relative w-full max-w-md">
        <Link to="/v2" className="inline-flex items-center gap-2 text-sm mb-6" style={{ color: "hsl(var(--v2-fg-muted))" }}>
          <ArrowLeft size={14} /> Back
        </Link>
        <div className="v2-card p-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: "hsl(var(--v2-accent))" }}>
              <Shield size={18} />
            </div>
            <div>
              <h1 className="font-semibold">Phantom <span className="text-xs ml-1 opacity-60">v2</span></h1>
              <p className="text-xs" style={{ color: "hsl(var(--v2-fg-muted))" }}>{isSignup ? "Create your account" : "Welcome back"}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <label className="text-xs block mb-1.5" style={{ color: "hsl(var(--v2-fg-muted))" }}>Username</label>
                <input className="v2-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="yourname" />
              </div>
            )}
            <div>
              <label className="text-xs block mb-1.5" style={{ color: "hsl(var(--v2-fg-muted))" }}>Email</label>
              <input type="email" required className="v2-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: "hsl(var(--v2-fg-muted))" }}>Password</label>
              <input type="password" required minLength={6} className="v2-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {error && (
              <div className="text-xs p-3 rounded" style={{ background: "hsl(var(--v2-danger) / 0.1)", color: "hsl(var(--v2-danger))", border: "1px solid hsl(var(--v2-danger) / 0.3)" }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="v2-btn v2-btn-primary w-full" style={{ padding: "0.625rem" }}>
              {loading ? "Loading..." : isSignup ? "Create account" : "Sign in"}
            </button>
          </form>

          <button onClick={() => setIsSignup(!isSignup)} className="text-xs mt-4 w-full text-center" style={{ color: "hsl(var(--v2-fg-muted))" }}>
            {isSignup ? "Already have an account? Sign in" : "No account? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default V2Auth;
