// Custom glowing "ULT" mark — Roblox-esque tilted-square with an inner U.
// No AI-generated image; hand-drawn SVG with layered purple neon glow.
const CloudLogo = ({ className = "", size = 40 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    className={className}
    style={{ animation: "logo-pulse 3.4s ease-in-out infinite" }}
    aria-label="ULT Cloud"
  >
    <defs>
      <linearGradient id="ultPurple" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stopColor="#c98bff" />
        <stop offset="55%" stopColor="#8b3dff" />
        <stop offset="100%" stopColor="#4a1a99" />
      </linearGradient>
      <linearGradient id="ultInner" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#1a0a2e" />
        <stop offset="100%" stopColor="#0d0417" />
      </linearGradient>
      <radialGradient id="ultShine" cx="30%" cy="25%" r="60%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
        <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
    </defs>
    {/* Rotated square (Roblox-style) with gradient border */}
    <g transform="rotate(12 20 20)">
      <rect x="4" y="4" width="32" height="32" rx="7" fill="url(#ultPurple)" />
      <rect x="6.5" y="6.5" width="27" height="27" rx="5.2" fill="url(#ultInner)" />
      <rect x="6.5" y="6.5" width="27" height="27" rx="5.2" fill="url(#ultShine)" />
      {/* Stylised U */}
      <path
        d="M14 13 V22 a6 6 0 0 0 12 0 V13"
        fill="none"
        stroke="url(#ultPurple)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* Tiny top spark */}
      <circle cx="30" cy="10" r="1.4" fill="#e8c8ff" />
    </g>
  </svg>
);

export default CloudLogo;
