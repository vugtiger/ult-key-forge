import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, Minus, X } from "lucide-react";
import CloudLogo from "@/components/CloudLogo";
import CloudBackground from "@/components/CloudBackground";

const PAGE_TITLE = "Free Roblox Key System vs Paid Script Protectors | ULT LUA";
const PAGE_DESCRIPTION =
  "Compare ULT LUA with paid Roblox key systems and script protectors. Free forever key generation, HWID locks, obfuscation, Discord bot and access monitoring.";

type Cell = boolean | "partial" | string;

const columns = ["ULT LUA", "Typical paid key system", "DIY loadstring"];

const rows: { feature: string; cells: Cell[] }[] = [
  { feature: "Price", cells: ["Free forever", "$5 - $30 / month", "Free"] },
  { feature: "Key system with expiry", cells: [true, true, false] },
  { feature: "HWID lock + device bans", cells: [true, "partial", false] },
  { feature: "Lua obfuscation built in", cells: [true, "partial", false] },
  { feature: "Source hidden from the raw URL", cells: [true, "partial", false] },
  { feature: "Per-game (Place ID) binding", cells: [true, "partial", false] },
  { feature: "Discord bot for keys & access", cells: [true, "partial", false] },
  { feature: "Live access monitoring", cells: [true, "partial", false] },
  { feature: "Identity-graph permanent bans", cells: [true, false, false] },
  { feature: "In-game key UI included", cells: [true, true, false] },
  { feature: "AI script assistant", cells: [true, false, false] },
  { feature: "Setup time", cells: ["Under 2 minutes", "10 - 30 minutes", "Manual"] },
];

const CellView = ({ value }: { value: Cell }) => {
  if (value === true)
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
        <Check size={16} /> Yes
      </span>
    );
  if (value === false)
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <X size={16} /> No
      </span>
    );
  if (value === "partial")
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-accent">
        <Minus size={16} /> Sometimes
      </span>
    );
  return <span className="text-sm font-medium text-foreground">{value}</span>;
};

const faqs = [
  {
    q: "Is ULT LUA really free?",
    a: "Yes. Every feature — key systems, HWID locks, obfuscation, the Discord bot and monitoring — is free forever. There are no premium tiers and no payment methods anywhere on the site.",
  },
  {
    q: "How is it different from a paid Roblox key system?",
    a: "Paid systems usually stop at key generation and a checkpoint link. ULT LUA also hides your source behind a dynamic loader, locks scripts to devices and games, and bans abusive users across IP, device, Roblox account and Discord account at once.",
  },
  {
    q: "Do I need to change my loadstring?",
    a: "No. You get a single branded loadstring for each script. Everything else — keys, protection layers, bans — is toggled from the dashboard without touching the line you hand out.",
  },
  {
    q: "Does it work with my executor?",
    a: "The loader ships fallbacks for common executor gaps, so it runs on the mainstream executors without extra setup.",
  },
];

const Compare = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const prevTitle = document.title;
    document.title = PAGE_TITLE;

    const setMeta = (selector: string, attr: string, key: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
      return el;
    };

    setMeta('meta[name="description"]', "name", "description", PAGE_DESCRIPTION);
    setMeta('meta[property="og:title"]', "property", "og:title", PAGE_TITLE);
    setMeta('meta[property="og:description"]', "property", "og:description", PAGE_DESCRIPTION);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${window.location.origin}/compare`;

    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "SoftwareApplication",
          name: "ULT LUA",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Web",
          description: PAGE_DESCRIPTION,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        },
        {
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        },
      ],
    });
    document.head.appendChild(ld);

    return () => {
      document.title = prevTitle;
      ld.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden grain-overlay">
      <CloudBackground />

      <div className="relative z-10 container mx-auto max-w-5xl px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-8 gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={18} />
          Back to Home
        </Button>

        <header className="text-center mb-12">
          <CloudLogo size={48} className="mx-auto mb-4" />
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            ULT LUA vs paid Roblox key systems
          </h1>
          <p className="mx-auto max-w-2xl text-sm sm:text-base text-muted-foreground">
            {PAGE_DESCRIPTION}
          </p>
        </header>

        {/* Comparison table */}
        <section aria-labelledby="comparison" className="mb-14">
          <h2 id="comparison" className="sr-only">
            Feature comparison
          </h2>
          <div className="glass-card overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Feature
                    </th>
                    {columns.map((c, i) => (
                      <th
                        key={c}
                        scope="col"
                        className={`p-4 text-xs font-semibold uppercase tracking-wider ${
                          i === 0 ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.feature} className="border-b border-border/60 last:border-0">
                      <th scope="row" className="p-4 text-sm font-medium text-foreground">
                        {row.feature}
                      </th>
                      {row.cells.map((cell, i) => (
                        <td key={i} className={`p-4 ${i === 0 ? "bg-primary/5" : ""}`}>
                          <CellView value={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq" className="mb-14">
          <h2 id="faq" className="mb-6 text-2xl font-bold">
            Frequently asked questions
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {faqs.map((f) => (
              <article key={f.q} className="glass-card rounded-2xl p-5">
                <h3 className="mb-2 text-sm font-semibold text-foreground">{f.q}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </article>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="depth-card rounded-2xl p-8 text-center">
          <h2 className="mb-2 text-2xl font-bold">Protect your first script in two minutes</h2>
          <p className="mx-auto mb-6 max-w-xl text-sm text-muted-foreground">
            Create an account, paste your Lua, and copy the branded loadstring. No payment, no trial,
            no limits.
          </p>
          <Button
            onClick={() => navigate("/auth")}
            size="lg"
            className="gap-2 rounded-xl bg-foreground text-background font-semibold hover:bg-foreground/90"
          >
            Get started free
            <ArrowRight size={18} />
          </Button>
        </section>
      </div>
    </div>
  );
};

export default Compare;
