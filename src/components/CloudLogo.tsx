// Luarmor-style shield crest — gold gradient, minimal, no external asset.
const CloudLogo = ({ className = "", size = 40 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    className={className}
    style={{ filter: "drop-shadow(0 2px 8px hsl(45 95% 55% / 0.35))" }}
    aria-label="ULT Cloud"
  >
    <defs>
      <linearGradient id="ultGold" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stopColor="#ffe27a" />
        <stop offset="55%" stopColor="#f5c542" />
        <stop offset="100%" stopColor="#c78a1e" />
      </linearGradient>
    </defs>
    <path
      d="M20 3 L34 8 V19 C34 27 28 33 20 37 C12 33 6 27 6 19 V8 Z"
      fill="url(#ultGold)"
      stroke="#8a5a11"
      strokeWidth="0.6"
    />
    <path
      d="M14 14 h12 M14 20 h12 M14 26 h8"
      stroke="#2a1a04"
      strokeWidth="1.6"
      strokeLinecap="round"
      opacity="0.85"
    />
  </svg>
);

export default CloudLogo;
