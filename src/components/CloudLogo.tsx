import shieldCloudLogo from "@/assets/shield-cloud-logo.png";

const CloudLogo = ({ className = "", size = 40 }: { className?: string; size?: number }) => (
  <img
    src={shieldCloudLogo}
    alt="ULT Cloud"
    width={size}
    height={size}
    className={className}
    style={{ width: size, height: size }}
  />
);

export default CloudLogo;
