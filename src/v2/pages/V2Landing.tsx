import { Link } from "react-router-dom";
import { Zap, Lock, Activity, ChevronRight, Code2, Eye, Webhook, ArrowUpRight, Layers, Fingerprint, Globe, GitBranch } from "lucide-react";
import NebulaLogo from "../components/NebulaLogo";
import "../styles/v2.css";

const V2Landing = () => {
  return (
    <div className="v2-root v2-grain">
      {/* Nav */}
      <nav className="border-b border-white/[0.06] sticky top-0 z-40 backdrop-blur-xl bg-black/40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/v2" className="flex items-center gap-2.5">
            <NebulaLogo size={26} className="text-white" />
            <span className="font-semibold tracking-tight text-base">Nebula</span>
          </Link>
          <div className="hidden md:flex items-center gap-7 text-sm text-white/60">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#protection" className="hover:text-white transition">Protection</a>
            <a href="#api" className="hover:text-white transition">API</a>
            <Link to="/" className="hover:text-white transition">v1</Link>
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
        <div className="v2-orb" style={{ top: "-10%", left: "20%", width: 600, height: 600, background: "rgba(255,255,255,0.06)" }} />
        <div className="v2-orb" style={{ top: "20%", right: "10%", width: 400, height: 400, background: "rgba(255,255,255,0.04)" }} />

        <div className="relative max-w-5xl mx-auto px-6 pt-28 pb-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-8 bg-white/5 border border-white/10 backdrop-blur-sm">
            <span className="v2-dot v2-dot-active" />
            <span className="text-white/70">Streamed delivery · per-key encryption · zero leaks</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 leading-[1.05]">
            Your script,<br />
            <span className="text-white/40">untouchable.</span>
          </h1>

          <p className="text-lg max-w-2xl mx-auto mb-10 text-white/55 leading-relaxed">
            Nebula splits, encrypts, and watermarks every script per-user. Attackers never see the
            full code — and if it leaks, you know exactly who.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link to="/v2/auth?mode=signup" className="v2-btn v2-btn-primary" style={{ padding: "0.75rem 1.5rem", fontSize: "0.95rem" }}>
              Start free <ArrowUpRight size={15} />
            </Link>
            <a href="#features" className="v2-btn v2-btn-secondary" style={{ padding: "0.75rem 1.5rem", fontSize: "0.95rem" }}>
              See features
            </a>
          </div>

          <div className="mt-20 grid grid-cols-3 gap-px bg-white/5 max-w-2xl mx-auto rounded-xl overflow-hidden border border-white/10">
            {[
              { v: "99.9%", l: "uptime" },
              { v: "<40ms", l: "key check" },
              { v: "0", l: "leaks traced back" },
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
          <div className="text-xs uppercase tracking-widest text-white/40 mb-3">Platform</div>
          <h2 className="text-4xl font-bold tracking-tight">Everything Luarmor has.<br />Plus what they don't.</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Lock, title: "HWID binding", desc: "Hardware-bound keys with cross-validation. Reset on demand." },
            { icon: Layers, title: "Streamed delivery", desc: "Scripts split into encrypted chunks. Attackers never see the whole thing." },
            { icon: Fingerprint, title: "Watermarking", desc: "Each user gets a unique fingerprint. Leaks trace back instantly." },
            { icon: Activity, title: "Real-time logs", desc: "Watch every key check, exec, and bypass attempt as it happens." },
            { icon: GitBranch, title: "Checkpoints", desc: "Linkvertise-style key claim flows. Monetize without ads on your site." },
            { icon: Code2, title: "Reseller system", desc: "Add staff who can generate keys without touching your dashboard." },
            { icon: Webhook, title: "Discord webhooks", desc: "Pipe redeems, execs, and bans straight to your server." },
            { icon: Globe, title: "Public REST API", desc: "Generate, check, revoke keys from your own backend with API tokens." },
            { icon: Eye, title: "Anti-debug", desc: "Detects executors, debuggers, and dump attempts at runtime." },
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

      {/* Protection */}
      <section id="protection" className="max-w-6xl mx-auto px-6 py-24 relative">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/40 mb-3">How it works</div>
            <h2 className="text-4xl font-bold tracking-tight mb-5">Three layers.<br />Zero compromises.</h2>
            <p className="text-white/55 leading-relaxed mb-8">
              We replaced VM obfuscation with something better — a layered runtime that
              never hands your code over in one piece.
            </p>
            <div className="space-y-4">
              {[
                { n: "01", t: "Streamed chunks", d: "Script splits into encrypted segments delivered just-in-time." },
                { n: "02", t: "Per-key cipher", d: "Every user gets a uniquely encrypted build with embedded watermark." },
                { n: "03", t: "Server-side resolution", d: "Strings & numbers replaced with token-gated lookups. Dump = useless." },
              ].map((s) => (
                <div key={s.n} className="flex gap-4">
                  <div className="text-xs font-mono text-white/30 mt-0.5">{s.n}</div>
                  <div>
                    <div className="font-semibold mb-0.5">{s.t}</div>
                    <div className="text-sm text-white/50">{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="v2-card p-6 relative overflow-hidden">
            <div className="text-xs text-white/40 mb-3 font-mono">delivery.lua</div>
            <pre className="text-xs text-white/70 v2-mono leading-relaxed overflow-x-auto">
{`-- nebula loader
local key = "NBL-XXXX-XXXX-XXXX"
local s = nebula:fetch(key)        -- encrypted chunks
local r = nebula:resolve(s)         -- server-side strings
return loadstring(r)()              -- watermarked exec`}
            </pre>
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-white/40">
              <span className="v2-dot v2-dot-active" /> watermark: u_482b9c · key locked to HWID
            </div>
          </div>
        </div>
      </section>

      {/* API */}
      <section id="api" className="max-w-5xl mx-auto px-6 py-24">
        <div className="v2-card p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 v2-grid-bg opacity-40" />
          <div className="relative">
            <div className="text-xs uppercase tracking-widest text-white/40 mb-3">REST API</div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Build your own flows.</h2>
            <p className="text-white/55 mb-8 max-w-md mx-auto">
              Generate API tokens, hit our endpoints, and integrate Nebula into anything.
            </p>
            <pre className="text-xs text-left max-w-md mx-auto bg-black/40 border border-white/10 p-4 rounded-lg v2-mono text-white/70 mb-8 overflow-x-auto">
{`curl -H "Authorization: Bearer NBL_..." \\
  https://nebula/api/keys/check?key=NBL-XXXX`}
            </pre>
            <Link to="/v2/auth?mode=signup" className="v2-btn v2-btn-primary" style={{ padding: "0.75rem 1.5rem" }}>
              Get an API token <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] mt-12">
        <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2 text-sm text-white/40">
            <NebulaLogo size={14} /> Nebula · © {new Date().getFullYear()}
          </div>
          <div className="flex gap-6 text-sm text-white/40">
            <Link to="/v2/auth" className="hover:text-white transition">Sign in</Link>
            <Link to="/" className="hover:text-white transition">v1 site</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default V2Landing;
