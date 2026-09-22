import { useEffect, useRef, useState, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Delay in ms before the reveal transition starts */
  delay?: number;
  /** Direction the content travels from */
  from?: "up" | "down" | "left" | "right" | "none" | "zoom";
  /** Animation duration in ms */
  duration?: number;
}

const OFFSETS: Record<NonNullable<RevealProps["from"]>, string> = {
  up: "translate3d(0, 44px, 0) scale(0.985)",
  down: "translate3d(0, -44px, 0) scale(0.985)",
  left: "translate3d(-44px, 0, 0) scale(0.985)",
  right: "translate3d(44px, 0, 0) scale(0.985)",
  zoom: "scale(0.92)",
  none: "none",
};

const Reveal = ({ children, className, delay = 0, from = "up", duration = 820 }: RevealProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : OFFSETS[from],
        filter: visible ? "none" : "blur(10px)",
        transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, filter ${duration}ms ease ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
};

export default Reveal;
