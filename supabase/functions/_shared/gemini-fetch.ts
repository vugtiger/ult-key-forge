const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const MODELS = ['gemini-3.8-flash'];
const ATTEMPTS = 4;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Calls Gemini's OpenAI-compatible endpoint. On temporary overload (429/5xx)
 * it retries with a short growing backoff (gemini-2.5-flash is retired, so no fallback model). Terminal statuses (400/401/403/404) are returned immediately.
 */
export async function fetchGemini(apiKey: string, payload: Record<string, unknown>): Promise<Response> {
  return fetchGeminiRequest(apiKey, ENDPOINT, { ...payload, model: MODELS[0] });
}

export async function fetchGeminiRequest(apiKey: string, endpoint: string, payload: Record<string, unknown>, native = false): Promise<Response> {
  let last: Response | null = null;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      if (attempt > 0) await sleep(attempt * 1000 + Math.floor(Math.random() * 400));
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: native ? { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' } : { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok || !RETRYABLE.has(res.status)) return res;
      const text = await res.text().catch(() => '');
      console.error('Gemini request failed', res.status);
      last = new Response(text, { status: res.status, headers: res.headers });
    }
  if (!last) throw new Error('Gemini returned no response');
  return last;
}
