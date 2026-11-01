import { fetchGemini } from './gemini-fetch.ts';

Deno.test('retries 503 overload then falls back to second model and succeeds', async () => {
  const models: string[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = ((_u: unknown, init: RequestInit) => {
    const m = JSON.parse(String(init.body)).model;
    models.push(m);
    return Promise.resolve(m === 'gemini-2.5-flash'
      ? new Response('{}', { status: 200 })
      : new Response('{"error":{"message":"busy"}}', { status: 503 }));
  }) as typeof fetch;
  try {
    const res = await fetchGemini('k', {});
    if (res.status !== 200) throw new Error('status ' + res.status);
    if (models.join() !== 'gemini-3.8-flash,gemini-3.8-flash,gemini-2.5-flash') throw new Error(models.join());
  } finally { globalThis.fetch = orig; }
});

Deno.test('does not retry a 401', async () => {
  let calls = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = (() => { calls++; return Promise.resolve(new Response('{}', { status: 401 })); }) as typeof fetch;
  try {
    const res = await fetchGemini('k', {});
    if (res.status !== 401 || calls !== 1) throw new Error(`${res.status}/${calls}`);
  } finally { globalThis.fetch = orig; }
});
