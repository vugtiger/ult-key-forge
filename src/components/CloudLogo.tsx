import wixLogo from "@/assets/wix-logo.png";

const CloudLogo = ({ className = "", size = 40 }: { className?: string; size?: number }) => (
  <img
    src={wixLogo}
    alt="ULT Cloud"
    width={size}
    height={size}
    className={className}
    style={{ width: size, height: size, objectFit: "contain", filter: "drop-shadow(0 4px 10px hsl(140 40% 50% / 0.25))" }}
  />
);

export default CloudLogo;
