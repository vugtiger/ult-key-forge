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