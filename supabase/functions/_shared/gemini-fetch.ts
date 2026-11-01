const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash'];
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Calls Gemini's OpenAI-compatible endpoint. On temporary overload (429/5xx)
 * it retries once per model with a short backoff, then falls back to the next
 * model. Terminal statuses (400/401/403/404) are returned immediately.
 */
export async function fetchGemini(apiKey: string, payload: Record<string, unknown>): Promise<Response> {
  let last: Response | null = null;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await sleep(700 + Math.floor(Math.random() * 400));
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, model }),
      });
      if (res.ok || !RETRYABLE.has(res.status)) return res;
      last = res;
      await res.body?.cancel().catch(() => {});
    }
  }
  return last!;
}
