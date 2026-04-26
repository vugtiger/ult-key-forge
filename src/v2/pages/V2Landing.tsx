import { Link } from "react-router-dom";
import { Shield, Zap, Lock, Activity, ChevronRight, Code2, Eye, Webhook, ArrowUpRight } from "lucide-react";
import "../styles/v2.css";

const V2Landing = () => {
  return (
    <div className="v2-root v2-grain">
      {/* Nav */}
      <nav className="border-b border-white/[0.06] sticky top-0 z-40 backdrop-blur-xl bg-black/40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white text-black">
              <Shield size={16} strokeWidth={2.5} />
            </div>
            <span className="font-semibold tracking-tight text-base">Phantom</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/5 text-white/50 ml-0.5 border border-white/10">v2</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/v2/auth" className="v2-btn v2-btn-ghost">Sign in</Link>
            <Link to="/v2/auth?mode=signup" className="v2-btn v2-btn-primary">
              Get started <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 v2-grid-bg" />
        <div className="v2-orb" style={{ top: "-10%", left: "20%", width: 500, height: 500, background: "rgba(255,255,255,0.06)" }} />
        <div className="v2-orb" style={{ top: "20%", right: "10%", width: 400, height: 400, background: "rgba(255,255,255,0.04)" }} />

        <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-8 bg-white/5 border border-white/10 backdrop-blur-sm">
            <span className="v2-dot v2-dot-active" />
            <span className="text-white/70">All systems operational</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 leading-[1.05]">
            Lua protection,<br />
            <span className="text-white/40">reimagined.</span>
          </h1>

          <p className="text-lg max-w-2xl mx-auto mb-10 text-white/55 leading-relaxed">
            HWID-bound keys. Real-time logs. Multi-stage obfuscation that doesn't break.
            Built for serious script developers who ship.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link to="/v2/auth?mode=signup" className="v2-btn v2-btn-primary" style={{ padding: "0.75rem 1.5rem", fontSize: "0.95rem" }}>
              Start free <ArrowUpRight size={15} />
            </Link>
            <a href="#features" className="v2-btn v2-btn-secondary" style={{ padding: "0.75rem 1.5rem", fontSize: "0.95rem" }}>
              See features
            </a>
          </div>

          {/* stats strip */}
          <div className="mt-20 grid grid-cols-3 gap-px bg-white/5 max-w-2xl mx-auto rounded-xl overflow-hidden border border-white/8">
            {[
              { v: "99.9%", l: "uptime" },
              { v: "<50ms", l: "key check" },
              { v: "0", l: "leaks" },
            ].map((s) => (
              <div key={s.l} className="bg-black/60 py-5 backdrop-blur-sm">
                <div className="text-2xl font-bold tracking-tight">{s.v}</div>
                <div className="text-[11px] uppercase tracking-wider text-white/40 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24 relative">
        <div className="text-center mb-16">
          <div className="text-xs uppercase tracking-widest text-white/40 mb-3">Features</div>
          <h2 className="text-4xl font-bold tracking-tight">Everything you need.<br />Nothing you don't.</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Lock, title: "HWID Binding", desc: "Hardware-bound keys with cross-validation. Stop spoofers cold." },
            { icon: Zap, title: "Instant delivery", desc: "Multi-stage dynamic obfuscation served in milliseconds." },
            { icon: Activity, title: "Real-time logs", desc: "Watch every key check, exec, and bypass attempt as it happens." },
            { icon: Code2, title: "Script vault", desc: "Version your protected scripts. Roll back when you break things." },
            { icon: Eye, title: "Anti-debug", desc: "Detects executors, debuggers, and dump attempts at runtime." },
            { icon: Webhook, title: "Webhooks", desc: "Pipe redeems, execs, and bans straight into your Discord." },
          ].map((f) => (
            <div key={f.title} className="v2-card p-6 group">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 bg-white/5 border border-white/10 group-hover:bg-white group-hover:text-black transition">
                <f.icon size={18} />
              </div>
              <h3 className="font-semibold mb-1.5">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="v2-card p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 v2-grid-bg opacity-50" />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Ready to ship protected?</h2>
            <p className="text-white/55 mb-8 max-w-md mx-auto">Free forever. No credit card. Set up your first project in under 60 seconds.</p>
            <Link to="/v2/auth?mode=signup" className="v2-btn v2-btn-primary" style={{ padding: "0.75rem 1.5rem" }}>
              Create your account <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] mt-12">
        <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-white/40">
            <Shield size={14} /> Phantom v2 · © {new Date().getFullYear()}
          </div>
          <div className="flex gap-6 text-sm text-white/40">
            <Link to="/v2/auth" className="hover:text-white transition">Sign in</Link>
            <Link to="/" className="hover:text-white transition">v1</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default V2Landing;
