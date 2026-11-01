import { geminiError } from './gemini-error.ts';

Deno.test('preserves Google quota error without workspace credit advice', async () => {
  const message = await geminiError(new Response(JSON.stringify({ error: { message: 'Google quota exceeded.' } }), { status: 429 }));
  if (message !== 'Google quota exceeded.') throw new Error(message);
});

Deno.test('redacts Google API keys from provider errors', async () => {
  const message = await geminiError(new Response(JSON.stringify({ error: { message: 'Invalid key AIzaExampleSecret123' } }), { status: 400 }));
  if (message !== 'Invalid key [redacted]') throw new Error('Secret not redacted');
});

Deno.test('preserves failure status when provider body is not JSON', async () => {
  const message = await geminiError(new Response('Unavailable', { status: 503 }));
  if (message !== 'Google Gemini request failed (503).') throw new Error(message);
});