// Nebula glyph — pure SVG, scales perfectly, themed via currentColor
const NebulaLogo = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Nebula"
  >
    {/* outer orbit ring */}
    <ellipse cx="16" cy="16" rx="13" ry="13" stroke="currentColor" strokeWidth="1.25" opacity="0.3" />
    {/* tilted orbit */}
    <ellipse
      cx="16"
      cy="16"
      rx="13"
      ry="5"
      stroke="currentColor"
      strokeWidth="1.25"
      transform="rotate(-25 16 16)"
    />
    {/* core */}
    <circle cx="16" cy="16" r="4" fill="currentColor" />
    {/* satellite */}
    <circle cx="26" cy="9" r="1.6" fill="currentColor" />
  </svg>
);

export default NebulaLogo;
