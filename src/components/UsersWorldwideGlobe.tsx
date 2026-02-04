import { useRef, useEffect, useState } from "react";

interface Point {
  x: number;
  y: number;
  z: number;
  originalX: number;
  originalY: number;
  originalZ: number;
  size: number;
}

const UsersWorldwideGlobe = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [userCount, setUserCount] = useState(2847);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const size = Math.min(400, window.innerWidth - 40);
    canvas.width = size;
    canvas.height = size;

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.4;

    // Generate globe points (dotted sphere pattern)
    const points: Point[] = [];
    const numLatitudes = 20;
    const dotsPerLatitude = 40;

    for (let lat = 0; lat < numLatitudes; lat++) {
      const phi = (Math.PI * lat) / numLatitudes;
      const y = Math.cos(phi) * radius;
      const latRadius = Math.sin(phi) * radius;
      const dotsInRow = Math.floor(dotsPerLatitude * Math.sin(phi));

      for (let lon = 0; lon < dotsInRow; lon++) {
        const theta = (2 * Math.PI * lon) / dotsInRow;
        const x = Math.cos(theta) * latRadius;
        const z = Math.sin(theta) * latRadius;

        points.push({
          x,
          y,
          z,
          originalX: x,
          originalY: y,
          originalZ: z,
          size: 1.5 + Math.random() * 0.5,
        });
      }
    }

    // Add some extra "continent-like" clusters for visual interest
    const addCluster = (
      basePhi: number,
      baseTheta: number,
      count: number,
      spread: number
    ) => {
      for (let i = 0; i < count; i++) {
        const phi = basePhi + (Math.random() - 0.5) * spread;
        const theta = baseTheta + (Math.random() - 0.5) * spread;
        const y = Math.cos(phi) * radius;
        const latRadius = Math.sin(phi) * radius;
        const x = Math.cos(theta) * latRadius;
        const z = Math.sin(theta) * latRadius;

        points.push({
          x,
          y,
          z,
          originalX: x,
          originalY: y,
          originalZ: z,
          size: 1.2 + Math.random() * 1,
        });
      }
    };

    // Add continent-like clusters (North America, Europe, Asia shapes)
    addCluster(Math.PI * 0.3, Math.PI * 0.5, 40, 0.4); // North America area
    addCluster(Math.PI * 0.35, Math.PI * 1.2, 35, 0.35); // Europe area
    addCluster(Math.PI * 0.4, Math.PI * 1.6, 50, 0.5); // Asia area
    addCluster(Math.PI * 0.65, Math.PI * 0.8, 25, 0.3); // South America area
    addCluster(Math.PI * 0.55, Math.PI * 1.3, 30, 0.35); // Africa area
    addCluster(Math.PI * 0.7, Math.PI * 1.8, 20, 0.25); // Australia area

    let rotation = 0;

    const animate = () => {
      if (!ctx) return;

      ctx.fillStyle = "transparent";
      ctx.clearRect(0, 0, size, size);

      rotation += 0.003;

      // Draw globe outline/glow
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        radius * 0.8,
        centerX,
        centerY,
        radius * 1.2
      );
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.03)");
      gradient.addColorStop(0.7, "rgba(255, 255, 255, 0.01)");
      gradient.addColorStop(1, "transparent");

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.1, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw subtle globe edge
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Sort points by z for depth
      const rotatedPoints = points
        .map((point) => {
          const cos = Math.cos(rotation);
          const sin = Math.sin(rotation);
          const x = point.originalX * cos - point.originalZ * sin;
          const z = point.originalX * sin + point.originalZ * cos;
          return { ...point, x, z };
        })
        .sort((a, b) => a.z - b.z);

      // Draw points
      rotatedPoints.forEach((point) => {
        // Only draw points on front half of sphere
        if (point.z < 0) return;

        const screenX = centerX + point.x;
        const screenY = centerY + point.y;

        // Opacity based on z position (depth)
        const depth = (point.z + radius) / (2 * radius);
        const opacity = 0.2 + depth * 0.8;

        ctx.beginPath();
        ctx.arc(screenX, screenY, point.size * (0.5 + depth * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.fill();
      });

      // Add a few "active user" blinking dots
      const time = Date.now() * 0.002;
      for (let i = 0; i < 3; i++) {
        const blinkPhase = Math.sin(time + i * 2) * 0.5 + 0.5;
        const angle = (time * 0.1 + i * 2.1) % (Math.PI * 2);
        const lat = Math.PI * 0.4 + Math.sin(time * 0.05 + i) * 0.3;

        const y = Math.cos(lat) * radius;
        const latRadius = Math.sin(lat) * radius;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const origX = Math.cos(angle) * latRadius;
        const origZ = Math.sin(angle) * latRadius;
        const x = origX * cos - origZ * sin;
        const z = origX * sin + origZ * cos;

        if (z > 0) {
          const screenX = centerX + x;
          const screenY = centerY + y;

          // Glowing dot
          const glowGradient = ctx.createRadialGradient(
            screenX,
            screenY,
            0,
            screenX,
            screenY,
            8
          );
          glowGradient.addColorStop(0, `rgba(255, 255, 255, ${0.8 * blinkPhase})`);
          glowGradient.addColorStop(0.5, `rgba(255, 255, 255, ${0.3 * blinkPhase})`);
          glowGradient.addColorStop(1, "transparent");

          ctx.beginPath();
          ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
          ctx.fillStyle = glowGradient;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(screenX, screenY, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * blinkPhase})`;
          ctx.fill();
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Simulate user count growth
    const countInterval = setInterval(() => {
      setUserCount((prev) => prev + Math.floor(Math.random() * 3));
    }, 5000);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      clearInterval(countInterval);
    };
  }, []);

  return (
    <div className="flex flex-col items-start gap-6">
      <div className="space-y-2">
        <h3 className="text-3xl md:text-4xl font-bold text-foreground">
          Users Worldwide
        </h3>
        <p className="text-muted-foreground max-w-md">
          Join our growing community of users who trust and use UltLua daily.
        </p>
        <div className="flex items-center gap-2 pt-2">
          <span className="text-2xl font-bold text-foreground">
            {userCount.toLocaleString()}+
          </span>
          <span className="text-muted-foreground">active users</span>
        </div>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full max-w-[400px] h-auto"
          style={{ background: "transparent" }}
        />
        {/* Ambient glow effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-white/5 rounded-full blur-[60px]" />
        </div>
      </div>
    </div>
  );
};

export default UsersWorldwideGlobe;
