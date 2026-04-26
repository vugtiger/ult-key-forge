import { Link } from "react-router-dom";
import { Shield, Zap, Lock, Activity, ChevronRight } from "lucide-react";
import "../styles/v2.css";

const V2Landing = () => {
  return (
    <div className="v2-root">
      {/* Nav */}
      <nav className="border-b" style={{ borderColor: "hsl(var(--v2-border))" }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: "hsl(var(--v2-accent))" }}>
              <Shield size={18} />
            </div>
            <span className="font-semibold tracking-tight">Phantom</span>
            <span className="text-xs px-1.5 py-0.5 rounded ml-1" style={{ background: "hsl(var(--v2-bg-elev))", color: "hsl(var(--v2-fg-muted))" }}>v2</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/v2/auth" className="v2-btn v2-btn-secondary">Sign in</Link>
            <Link to="/v2/auth?mode=signup" className="v2-btn v2-btn-primary">Get started <ChevronRight size={14} /></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 v2-grid-bg opacity-40" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at top, hsl(var(--v2-accent) / 0.15), transparent 60%)" }} />
        <div className="relative max-w-5xl mx-auto px-6 py-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-6" style={{ background: "hsl(var(--v2-bg-elev))", border: "1px solid hsl(var(--v2-border))" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(var(--v2-success))" }} />
            All systems operational
          </div>
          <h1 className="text-6xl font-bold tracking-tight mb-6">
            Lua script protection,<br />
            <span style={{ background: "linear-gradient(90deg, hsl(var(--v2-accent)), hsl(280 70% 70%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              done right.
            </span>
          </h1>
          <p className="text-lg max-w-2xl mx-auto mb-10" style={{ color: "hsl(var(--v2-fg-muted))" }}>
            HWID-bound keys, real-time analytics, and obfuscation that doesn't suck. Built for serious script developers.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/v2/auth?mode=signup" className="v2-btn v2-btn-primary" style={{ padding: "0.75rem 1.5rem" }}>Start for free</Link>
            <a href="#features" className="v2-btn v2-btn-secondary" style={{ padding: "0.75rem 1.5rem" }}>Learn more</a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: Lock, title: "HWID Binding", desc: "Hardware-bound keys with cross-validation. No more spoofing." },
            { icon: Zap, title: "Instant Delivery", desc: "Multi-stage dynamic obfuscation served in milliseconds." },
            { icon: Activity, title: "Real-time Logs", desc: "Watch every key check, exec, and bypass attempt as it happens." },
          ].map((f) => (
            <div key={f.title} className="v2-card p-6">
              <div className="w-10 h-10 rounded-md flex items-center justify-center mb-4" style={{ background: "hsl(var(--v2-accent) / 0.15)", color: "hsl(var(--v2-accent))" }}>
                <f.icon size={20} />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm" style={{ color: "hsl(var(--v2-fg-muted))" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t mt-12" style={{ borderColor: "hsl(var(--v2-border))" }}>
        <div className="max-w-7xl mx-auto px-6 py-8 text-sm" style={{ color: "hsl(var(--v2-fg-muted))" }}>
          © {new Date().getFullYear()} Phantom Protection
        </div>
      </footer>
    </div>
  );
};

export default V2Landing;
