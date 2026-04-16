import { useRef, useState, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Tilt3DCardProps {
  children: ReactNode;
  className?: string;
  glare?: boolean;
  intensity?: number;
}

const Tilt3DCard = ({ children, className, glare = true, intensity = 12 }: Tilt3DCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState({ transform: "perspective(800px) rotateX(0deg) rotateY(0deg)", transition: "transform 0.4s cubic-bezier(0.03,0.98,0.52,0.99)" });
  const [glareStyle, setGlareStyle] = useState({ opacity: 0, background: "" });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateX = (0.5 - y) * intensity;
    const rotateY = (x - 0.5) * intensity;
    setStyle({
      transform: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02,1.02,1.02)`,
      transition: "transform 0.1s ease-out",
    });
    if (glare) {
      const angle = Math.atan2(y - 0.5, x - 0.5) * (180 / Math.PI) + 90;
      setGlareStyle({
        opacity: 0.12,
        background: `linear-gradient(${angle}deg, rgba(255,255,255,0.25) 0%, transparent 80%)`,
      });
    }
  };

  const handleLeave = () => {
    setStyle({
      transform: "perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)",
      transition: "transform 0.4s cubic-bezier(0.03,0.98,0.52,0.99)",
    });
    setGlareStyle({ opacity: 0, background: "" });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={cn("relative overflow-hidden", className)}
      style={{ ...style, transformStyle: "preserve-3d" }}
    >
      {children}
      {glare && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ opacity: glareStyle.opacity, background: glareStyle.background, transition: "opacity 0.3s" }}
        />
      )}
    </div>
  );
};

export default Tilt3DCard;
