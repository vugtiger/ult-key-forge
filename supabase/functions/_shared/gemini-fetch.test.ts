import { fetchGemini } from './gemini-fetch.ts';

Deno.test('falls through models on 503 then succeeds', async () => {
  let calls = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = (() => {
    calls++;
    return Promise.resolve(calls < 3 ? new Response('{"error":{"message":"busy"}}', { status: 503 }) : new Response('{}', { status: 200 }));
  }) as typeof fetch;
  try {
    const res = await fetchGemini('k', {});
    if (res.status !== 200 || calls !== 3) throw new Error(`${res.status}/${calls}`);
  } finally { globalThis.fetch = orig; }
});

Deno.test('keeps provider message after exhausting retries', async () => {
  let calls = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = (() => { calls++; return Promise.resolve(new Response('{"error":{"message":"busy"}}', { status: 503 })); }) as typeof fetch;
  try {
    const res = await fetchGemini('k', {});
    if (res.status !== 503 || calls !== 3 || !(await res.text()).includes('busy')) throw new Error(`${res.status}/${calls}`);
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
