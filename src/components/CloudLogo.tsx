// Actual Roblox logo shape (tilted square with off-center square cutout), purple themed.
const CloudLogo = ({ className = "", size = 40 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 512 512"
    className={className}
    aria-label="ULT"
  >
    <defs>
      <linearGradient id="robloxPurple" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stopColor="hsl(285 95% 72%)" />
        <stop offset="55%" stopColor="hsl(272 92% 60%)" />
        <stop offset="100%" stopColor="hsl(265 85% 38%)" />
      </linearGradient>
    </defs>
    {/* Roblox mark: outer tilted square with square hole */}
    <path
      fill="url(#robloxPurple)"
      fillRule="evenodd"
      d="M116 0 L512 116 L396 512 L0 396 Z M198 214 L214 314 L314 298 L298 198 Z"
    />
  </svg>
);

export default CloudLogo;
