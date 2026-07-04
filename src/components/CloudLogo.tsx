// Roblox-style tilted square mark, purple-themed to match the site.
// The actual Roblox logo is a tilted square with an off-center square cutout.
const CloudLogo = ({ className = "", size = 40 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    className={className}
    style={{ animation: "logo-pulse 3.4s ease-in-out infinite" }}
    aria-label="ULT"
  >
    <defs>
      <linearGradient id="ultBox" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stopColor="#c98bff" />
        <stop offset="55%" stopColor="#8b3dff" />
        <stop offset="100%" stopColor="#4a1a99" />
      </linearGradient>
      <linearGradient id="ultCut" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stopColor="#f4e6ff" />
        <stop offset="100%" stopColor="#d9b8ff" />
      </linearGradient>
      <radialGradient id="ultGlint" cx="28%" cy="22%" r="60%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
        <stop offset="70%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
    </defs>
    {/* Roblox-style: tilted rounded square with off-center square cutout */}
    <g transform="rotate(18 20 20)">
      <rect x="5" y="5" width="30" height="30" rx="3.5" fill="url(#ultBox)" />
      <rect x="5" y="5" width="30" height="30" rx="3.5" fill="url(#ultGlint)" />
      <rect x="16" y="16" width="12" height="12" rx="1.2" fill="url(#ultCut)" />
    </g>
  </svg>
);

export default CloudLogo;
