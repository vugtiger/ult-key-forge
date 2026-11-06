import { supabase } from '@/integrations/supabase/client';

let speechGeneration = 0;
let activeAudio: AudioBufferSourceNode | null = null;
let audioContext: AudioContext | null = null;

// Browsers block sound until the user taps once. Unlock audio on the very first
// tap anywhere (including the tap that opens the admin panel).
function unlockAudio() {
  try {
    audioContext ??= new AudioContext();
    void audioContext.resume();
    window.speechSynthesis?.getVoices();
  } catch { /* ignore */ }
}
if (typeof window !== 'undefined') {
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlockAudio, { capture: true, passive: true }));
}

function waitForAudioUnlock(): Promise<void> {
  if (!audioContext || audioContext.state === 'running') return Promise.resolve();
  return new Promise(resolve => {
    const done = () => { void audioContext?.resume().finally(resolve); ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.removeEventListener(ev, done, true)); };
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, done, { capture: true, once: true }));
  });
}

const CACHE_PREFIX = 'jarvis-voice:british-male-v2:';
function readCache(text: string) {
  try { const v = localStorage.getItem(CACHE_PREFIX + text); return v ? JSON.parse(v) : null; } catch { return null; }
}
function writeCache(text: string, data: unknown) {
  try { if (text.length <= 120) localStorage.setItem(CACHE_PREFIX + text, JSON.stringify(data)); } catch { /* storage full */ }
}

export function stopJarvisSpeech() {
  speechGeneration++;
  activeAudio?.stop();
  activeAudio = null;
  window.speechSynthesis?.cancel();
}

export async function speakJarvis(text: string, onStart: () => void, onEnd: () => void, maxWaitMs?: number) {
  stopJarvisSpeech();
  const generation = speechGeneration;
  try {
    audioContext ??= new AudioContext();
    void audioContext.resume();
    const cached = readCache(text);
    let data = cached, error: unknown = null;
    if (!cached) {
      const request = supabase.functions.invoke('jarvis-speech', { body: { text: text.slice(0, 1500) } });
      ({ data, error } = maxWaitMs
        ? await Promise.race([request, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Natural voice too slow')), maxWaitMs))])
        : await request);
      if (!error && data?.audio) writeCache(text, data);
    }
    if (generation !== speechGeneration) return;
    if (error || !data?.audio) throw new Error('Natural voice unavailable');
    const binary = atob(data.audio);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    let buffer: AudioBuffer;
    if (String(data.mimeType).includes('wav')) {
      buffer = await audioContext.decodeAudioData(bytes.buffer);
    } else {
      const samples = Math.floor(bytes.length / 2);
      buffer = audioContext.createBuffer(1, samples, data.sampleRate || 24000);
      const view = new DataView(bytes.buffer);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < samples; i++) channel[i] = view.getInt16(i * 2, true) / 32768;
    }
    await waitForAudioUnlock();
    if (generation !== speechGeneration) return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.onended = () => { if (generation === speechGeneration) { activeAudio = null; onEnd(); } };
    activeAudio = source;
    onStart();
    source.start();
  } catch {
    if (generation !== speechGeneration) return;
    if (!window.speechSynthesis) { onEnd(); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    configureJarvisSpeech(utterance);
    utterance.onstart = onStart;
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
    window.speechSynthesis.speak(utterance);
  }
}

/** Plays a pre-recorded natural Jarvis clip instantly (no network to Gemini). */
export async function playJarvisClip(url: string, fallbackText: string) {
  stopJarvisSpeech();
  const generation = speechGeneration;
  try {
    audioContext ??= new AudioContext();
    void audioContext.resume();
    const bytes = await (await fetch(url)).arrayBuffer();
    const buffer = await audioContext.decodeAudioData(bytes);
    await waitForAudioUnlock();
    if (generation !== speechGeneration) return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    activeAudio = source;
    source.start();
  } catch {
    if (generation === speechGeneration) void speakJarvis(fallbackText, () => {}, () => {}, 4000);
  }
}

export function configureJarvisSpeech(utterance: SpeechSynthesisUtterance) {
  const voices = window.speechSynthesis.getVoices();
  const british = voices.filter(v => /^en[-_]GB$/i.test(v.lang));
  const preferred = ['Google UK English Male', 'Daniel', 'Microsoft Ryan', 'Microsoft George', 'Arthur', 'Oliver', 'James'];
  const voice = preferred.map(name => british.find(v => v.name.includes(name))).find(Boolean)
    ?? british.find(v => /male/i.test(v.name) && !/female/i.test(v.name))
    ?? voices.find(v => v.lang.startsWith('en') && /\b(male|daniel|aaron|arthur|fred|alex|tom|rishi)\b/i.test(v.name) && !/female/i.test(v.name))
    ?? british.find(v => !/female|sonia|susan|serena|hazel|kate|libby|martha|stephanie|samantha|karen|moira|tessa|fiona/i.test(v.name))
    ?? british[0];
  const male = voice && !/female|sonia|susan|serena|hazel|kate|libby|martha|stephanie|samantha|karen|moira|tessa|fiona/i.test(voice.name) && /male|daniel|arthur|ryan|george|oliver|james|aaron|fred|alex|tom|rishi/i.test(voice.name);
  if (voice) utterance.voice = voice;
  utterance.lang = 'en-GB';
  utterance.rate = 0.94;
  utterance.pitch = male ? 0.9 : 0.6;
  utterance.volume = 1;
}

export async function functionErrorMessage(error: unknown): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
    const body = await error.context.clone().json().catch(() => null);
    if (typeof body?.error === 'string') return body.error;
  }
  return error instanceof Error ? error.message : 'Unable to reach Gemini. Please try again later.';
}