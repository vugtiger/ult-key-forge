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
    <div className="v2-root v2-grain min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 v2-grid-bg opacity-60" />
      <div className="v2-orb" style={{ top: "10%", left: "30%", width: 400, height: 400, background: "rgba(255,255,255,0.05)" }} />

      <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <Link to="/v2" className="inline-flex items-center gap-2 text-sm mb-8 text-white/50 hover:text-white transition">
          <ArrowLeft size={14} /> Back to home
        </Link>

        <div className="w-full max-w-sm v2-animate">
          <div className="v2-card p-8 backdrop-blur-2xl">
            <div className="flex items-center gap-2.5 mb-7">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white text-black">
                <Shield size={17} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="font-semibold text-base">Phantom <span className="text-[10px] ml-0.5 px-1 py-0.5 rounded bg-white/10 text-white/50 align-middle">v2</span></h1>
                <p className="text-xs text-white/50 mt-0.5">{isSignup ? "Create your account" : "Welcome back"}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {isSignup && (
                <div>
                  <label className="text-xs block mb-1.5 text-white/60 font-medium">Username</label>
                  <input className="v2-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="yourname" />
                </div>
              )}
              <div>
                <label className="text-xs block mb-1.5 text-white/60 font-medium">Email</label>
                <input type="email" required className="v2-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div>
                <label className="text-xs block mb-1.5 text-white/60 font-medium">Password</label>
                <input type="password" required minLength={6} className="v2-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              {error && (
                <div className="text-xs p-3 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading} className="v2-btn v2-btn-primary w-full" style={{ padding: "0.65rem", marginTop: "0.5rem" }}>
                {loading ? "Loading..." : isSignup ? "Create account" : "Sign in"}
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-white/5 text-center">
              <button onClick={() => setIsSignup(!isSignup)} className="text-xs text-white/50 hover:text-white transition">
                {isSignup ? "Already have an account? Sign in" : "No account? Create one"}
              </button>
            </div>
          </div>

          <p className="text-center text-[11px] text-white/30 mt-6">
            By continuing you agree to our terms · v2 accounts are separate from v1
          </p>
        </div>
      </div>
    </div>
  );
};

export default V2Auth;
