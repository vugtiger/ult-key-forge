import { supabase } from '@/integrations/supabase/client';

let speechGeneration = 0;
let activeAudio: AudioBufferSourceNode | null = null;
let audioContext: AudioContext | null = null;

export function stopJarvisSpeech() {
  speechGeneration++;
  activeAudio?.stop();
  activeAudio = null;
  window.speechSynthesis?.cancel();
}

export async function speakJarvis(text: string, onStart: () => void, onEnd: () => void) {
  stopJarvisSpeech();
  const generation = speechGeneration;
  try {
    audioContext ??= new AudioContext();
    await audioContext.resume();
    const { data, error } = await supabase.functions.invoke('jarvis-speech', { body: { text: text.slice(0, 1500) } });
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

export function configureJarvisSpeech(utterance: SpeechSynthesisUtterance) {
  const voices = window.speechSynthesis.getVoices();
  const british = voices.filter(v => /^en[-_]GB$/i.test(v.lang));
  const preferred = ['Google UK English Male', 'Daniel', 'Microsoft Ryan', 'Microsoft George', 'Arthur', 'Oliver', 'James'];
  const voice = preferred.map(name => british.find(v => v.name.includes(name))).find(Boolean)
    ?? british.find(v => !/female|sonia|susan|serena|hazel/i.test(v.name))
    ?? british[0]
    ?? voices.find(v => v.lang.startsWith('en'));
  if (voice) utterance.voice = voice;
  utterance.lang = 'en-GB';
  utterance.rate = 0.94;
  utterance.pitch = 1;
  utterance.volume = 1;
}

export async function functionErrorMessage(error: unknown): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
    const body = await error.context.clone().json().catch(() => null);
    if (typeof body?.error === 'string') return body.error;
  }
  return error instanceof Error ? error.message : 'Unable to reach Gemini. Please try again later.';
}