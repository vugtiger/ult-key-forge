// Luarmor-style backdrop: subtle grid + faint chart-line silhouette. No 3D shapes.
const CloudBackground = () => (
  <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden>
    {/* Grid */}
    <div
      className="absolute inset-0 opacity-[0.06]"
      style={{
        backgroundImage:
          "linear-gradient(hsl(45 60% 60%) 1px, transparent 1px), linear-gradient(90deg, hsl(45 60% 60%) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
        maskImage: "radial-gradient(ellipse at 50% 30%, black 40%, transparent 80%)",
        WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, black 40%, transparent 80%)",
      }}
    />
    {/* Faint chart line */}
    <svg
      className="absolute inset-x-0 bottom-0 w-full h-[55%] opacity-[0.08]"
      viewBox="0 0 1200 400"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(45 95% 62%)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="hsl(45 95% 62%)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 320 L100 280 L200 300 L320 210 L440 240 L560 160 L680 200 L820 120 L960 170 L1080 90 L1200 130 L1200 400 L0 400 Z"
        fill="url(#lineFill)"
      />
      <path
        d="M0 320 L100 280 L200 300 L320 210 L440 240 L560 160 L680 200 L820 120 L960 170 L1080 90 L1200 130"
        fill="none"
        stroke="hsl(45 95% 62%)"
        strokeWidth="2"
      />
    </svg>
    {/* Vignette */}
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, transparent 40%, hsl(222 45% 4% / 0.7) 100%)",
      }}
    />
  </div>
);

export default CloudBackground;
