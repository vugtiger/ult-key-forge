import { useEffect, useRef, useCallback } from "react";

// Shared audio context for the entire app
let globalAudioCtx: AudioContext | null = null;
let globalGainNode: GainNode | null = null;
let globalSourceNode: AudioBufferSourceNode | null = null;
let audioInitialized = false;

const initAudio = () => {
  if (audioInitialized) return;
  audioInitialized = true;

  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    globalAudioCtx = audioCtx;

    // Create a longer buffer for seamless looping (8 seconds)
    const bufferSize = audioCtx.sampleRate * 8;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate soft wind/snow noise with smooth fade in/out for seamless loop
    const fadeLen = audioCtx.sampleRate * 0.5; // 0.5s fade
    for (let i = 0; i < bufferSize; i++) {
      let sample = (Math.random() * 2 - 1) * 0.025;
      // Smooth fade in
      if (i < fadeLen) sample *= i / fadeLen;
      // Smooth fade out
      if (i > bufferSize - fadeLen) sample *= (bufferSize - i) / fadeLen;
      data[i] = sample;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = buffer.duration;

    // Bandpass filter for soft wind
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 600;
    filter.Q.value = 0.4;

    // Second filter for warmth
    const lowpass = audioCtx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 2000;

    const gain = audioCtx.createGain();
    gain.gain.value = 0.18; // Louder than before

    source.connect(filter);
    filter.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(audioCtx.destination);
    source.start();

    globalGainNode = gain;
    globalSourceNode = source;

    // Handle tab visibility to prevent audio stopping
    const handleVisibility = () => {
      if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
        globalAudioCtx.resume();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
  } catch (e) {
    // Audio not supported
  }
};

// Button click snow sound effect
export const playButtonClickSound = () => {
  try {
    const ctx = globalAudioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
    if (!globalAudioCtx) globalAudioCtx = ctx;

    // Create a short "crunch in snow" sound
    const duration = 0.15;
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / sampleRate;
      // Mix of noise with rapid decay for "crunch" feel
      const envelope = Math.exp(-t * 25);
      const noise = (Math.random() * 2 - 1) * 0.4;
      data[i] = noise * envelope;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    filter.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.value = 0.25;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  } catch (e) {
    // Ignore
  }
};

// Snow burst animation at coordinates
export const createSnowBurst = (x: number, y: number) => {
  const count = 8;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: ${Math.random() * 4 + 2}px;
      height: ${Math.random() * 4 + 2}px;
      background: white;
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      opacity: 0.8;
    `;
    document.body.appendChild(particle);

    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 30 + Math.random() * 40;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed - 20; // Bias upward

    particle.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 0.8 },
      { transform: `translate(${dx}px, ${dy + 40}px) scale(0)`, opacity: 0 },
    ], {
      duration: 400 + Math.random() * 200,
      easing: 'cubic-bezier(0, 0.5, 0.5, 1)',
    }).onfinish = () => particle.remove();
  }
};

const SnowEffect = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

        if (f.y > h) { f.y = -5; f.x = Math.random() * w; }
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

    // Initialize audio on first interaction
    const startAudio = () => {
      initAudio();
      document.removeEventListener("click", startAudio);
      document.removeEventListener("keydown", startAudio);
    };
    document.addEventListener("click", startAudio);
    document.addEventListener("keydown", startAudio);

    // Keep audio alive when switching tabs
    const handleVisibility = () => {
      if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
        globalAudioCtx.resume();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("click", startAudio);
      document.removeEventListener("keydown", startAudio);
      document.removeEventListener('visibilitychange', handleVisibility);
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
