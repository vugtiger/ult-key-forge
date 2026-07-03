// Purple-themed Roblox-style tilted square mark with stylized R.
// Hand-drawn SVG — no AI art, no external logo, matches ULT purple theme.
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
      <linearGradient id="ultRLetter" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#e6d0ff" />
      </linearGradient>
      <radialGradient id="ultGlint" cx="28%" cy="22%" r="60%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
        <stop offset="70%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
    </defs>
    {/* Tilted rounded square, Roblox-style */}
    <g transform="rotate(14 20 20)">
      <rect x="4" y="4" width="32" height="32" rx="6" fill="url(#ultBox)" />
      <rect x="4" y="4" width="32" height="32" rx="6" fill="url(#ultGlint)" />
      {/* Blocky R: vertical stem, top loop, kicked leg */}
      <path
        d="M14 12 h8 a5 5 0 0 1 0 10 h-4 l6 6 h-4 l-6 -6 v6 h-4 z"
        fill="url(#ultRLetter)"
      />
      {/* Loop cutout */}
      <rect x="18" y="15" width="4.5" height="4" rx="1.2" fill="url(#ultBox)" />
    </g>
  </svg>
);

export default CloudLogo;
