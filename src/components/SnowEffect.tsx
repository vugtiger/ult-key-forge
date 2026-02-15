import { useEffect, useRef } from "react";

const SnowEffect = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    const flakeCount = 120;
    const flakes: { x: number; y: number; r: number; speed: number; wind: number; opacity: number }[] = [];

    for (let i = 0; i < flakeCount; i++) {
      flakes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 3 + 1,
        speed: Math.random() * 1.5 + 0.5,
        wind: Math.random() * 0.5 - 0.25,
        opacity: Math.random() * 0.6 + 0.2,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const f of flakes) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${f.opacity})`;
        ctx.fill();

        f.y += f.speed;
        f.x += f.wind + Math.sin(f.y * 0.01) * 0.3;

        if (f.y > h) {
          f.y = -5;
          f.x = Math.random() * w;
        }
        if (f.x > w) f.x = 0;
        if (f.x < 0) f.x = w;
      }
      animationId = requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    window.addEventListener("resize", handleResize);

    // Subtle ambient snow sound via Web Audio API
    const playAmbient = () => {
      if (hasPlayedRef.current) return;
      hasPlayedRef.current = true;

      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Create white noise (soft static = snow-like)
        const bufferSize = audioCtx.sampleRate * 4;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.015; // Very quiet
        }

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        // Bandpass filter to make it sound more like soft wind/snow
        const filter = audioCtx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 800;
        filter.Q.value = 0.5;

        const gain = audioCtx.createGain();
        gain.gain.value = 0.08; // Keep it subtle

        source.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        source.start();

        audioRef.current = { pause: () => { gain.gain.value = 0; source.stop(); audioCtx.close(); } } as any;
      } catch (e) {
        // Audio not supported or blocked
      }
    };

    // Play on first user interaction
    const startAudio = () => {
      playAmbient();
      document.removeEventListener("click", startAudio);
      document.removeEventListener("keydown", startAudio);
    };
    document.addEventListener("click", startAudio);
    document.addEventListener("keydown", startAudio);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("click", startAudio);
      document.removeEventListener("keydown", startAudio);
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch {}
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[1]"
      style={{ mixBlendMode: "screen" }}
    />
  );
};

export default SnowEffect;
