import { useEffect, useRef } from "react";

// Lightweight rotating wireframe globe with pulsing activity dots.
// Pure canvas — no heavy 3D dependency.
const ActivityGlobe = ({ size = 320, points = 40 }: { size?: number; points?: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    // Random surface points (lat/lon)
    const pts = Array.from({ length: points }, () => ({
      lat: (Math.random() - 0.5) * Math.PI,
      lon: Math.random() * Math.PI * 2,
      pulse: Math.random() * Math.PI * 2,
    }));

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 12;

    let raf = 0;
    const draw = () => {
      rotRef.current += 0.003;
      ctx.clearRect(0, 0, size, size);

      // Outer glow
      const grad = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 1.15);
      grad.addColorStop(0, "hsla(272,92%,55%,0)");
      grad.addColorStop(1, "hsla(272,92%,55%,0.18)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
      ctx.fill();

      // Sphere fill
      const sphere = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.1, cx, cy, r);
      sphere.addColorStop(0, "hsla(272,60%,20%,0.9)");
      sphere.addColorStop(1, "hsla(260,50%,6%,0.95)");
      ctx.fillStyle = sphere;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "hsla(272,80%,60%,0.35)";
      ctx.lineWidth = 1;

      // Latitude lines
      for (let i = 1; i < 8; i++) {
        const lat = (-Math.PI / 2) + (i * Math.PI) / 8;
        const y = cy + r * Math.sin(lat);
        const rx = r * Math.cos(lat);
        ctx.beginPath();
        ctx.ellipse(cx, y, rx, rx * 0.15, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Longitude lines (rotate with globe)
      for (let i = 0; i < 12; i++) {
        const lon = rotRef.current + (i * Math.PI) / 6;
        const rx = Math.abs(r * Math.cos(lon));
        if (rx < 0.5) continue;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, r, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Border
      ctx.strokeStyle = "hsla(272,92%,66%,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // Activity dots
      pts.forEach((p) => {
        p.pulse += 0.05;
        const lon = p.lon + rotRef.current;
        const x3 = Math.cos(p.lat) * Math.sin(lon);
        const z3 = Math.cos(p.lat) * Math.cos(lon);
        const y3 = Math.sin(p.lat);
        if (z3 < 0) return; // behind sphere
        const px = cx + x3 * r;
        const py = cy + y3 * r;
        const alpha = 0.4 + 0.6 * z3;
        const pulse = (Math.sin(p.pulse) + 1) / 2;

        ctx.fillStyle = `hsla(285,95%,70%,${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.8 + pulse * 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Halo
        ctx.fillStyle = `hsla(272,92%,66%,${alpha * 0.25 * pulse})`;
        ctx.beginPath();
        ctx.arc(px, py, 5 + pulse * 4, 0, Math.PI * 2);
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [size, points]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="mx-auto"
      aria-label="Global activity"
    />
  );
};

export default ActivityGlobe;
