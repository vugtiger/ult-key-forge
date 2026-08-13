import { useEffect, useRef } from "react";

// Background music (looping) + UI click sound system.
// Kept the file name for backwards compatibility with existing imports.

let audioEl: HTMLAudioElement | null = null;
let audioInitialized = false;
let audioMuted = false;
let clickCtx: AudioContext | null = null;

const MUSIC_SRC = "/audio/bg-music.mp3";

const ensureClickCtx = () => {
  if (!clickCtx) {
    try {
      clickCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {}
  }
  return clickCtx;
};

const initAudio = () => {
  if (audioInitialized) return;
  audioInitialized = true;

  const saved = localStorage.getItem("bg-music-muted");
  audioMuted = saved === "true";

  try {
    audioEl = new Audio(MUSIC_SRC);
    audioEl.loop = true;
    audioEl.volume = audioMuted ? 0 : 0.35;
    audioEl.preload = "auto";
    audioEl.play().catch(() => {
      // Autoplay blocked; will retry on next interaction
      const retry = () => {
        audioEl?.play().catch(() => {});
        document.removeEventListener("click", retry);
        document.removeEventListener("keydown", retry);
      };
      document.addEventListener("click", retry);
      document.addEventListener("keydown", retry);
    });
  } catch {}
};

export const toggleSnowSound = (): boolean => {
  audioMuted = !audioMuted;
  localStorage.setItem("bg-music-muted", String(audioMuted));
  if (audioEl) audioEl.volume = audioMuted ? 0 : 0.35;
  return !audioMuted;
};

export const isSnowSoundOn = (): boolean => {
  const saved = localStorage.getItem("bg-music-muted");
  return saved !== "true";
};

// Modern soft "tick" click sound (replaces previous snow noise)
export const playButtonClickSound = () => {
  if (audioMuted) return;
  try {
    const ctx = ensureClickCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const now = ctx.currentTime;

    // Soft sine "pop"
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  } catch {}
};

// Burst kept as no-op to preserve existing call sites
export const createSnowBurst = (_x: number, _y: number) => {};

const SnowEffect = () => {
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const start = () => {
      initAudio();
      document.removeEventListener("click", start);
      document.removeEventListener("keydown", start);
    };
    document.addEventListener("click", start);
    document.addEventListener("keydown", start);

    // Try immediately too (works after first SPA navigation)
    initAudio();

    return () => {
      document.removeEventListener("click", start);
      document.removeEventListener("keydown", start);
    };
  }, []);

  return null;
};

export default SnowEffect;
