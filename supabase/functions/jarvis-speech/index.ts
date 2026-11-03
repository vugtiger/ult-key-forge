import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { fetchGeminiRequest } from '../_shared/gemini-fetch.ts';
import { geminiError } from '../_shared/gemini-error.ts';

Deno.serve(async req => {
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Please sign in to use Jarvis.' }, 401);
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const key = Deno.env.get('GEMINI_API_KEY');
    if (!url || !anon || !service || !key) return json({ error: 'Jarvis voice is not configured.' }, 503);
    const client = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ error: 'Please sign in to use Jarvis.' }, 401);
    const admin = createClient(url, service);
    const { data: role } = await admin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!role) return json({ error: 'Jarvis voice is available to the owner only.' }, 403);
    const parsed = z.object({ text: z.string().trim().min(1).max(1500) }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: 'Supply a spoken response of 1–1500 characters.' }, 400);
    const response = await fetchGeminiRequest(key, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent', {
      contents: [{ role: 'user', parts: [{ text: parsed.data.text, speech_metadata: { style: 'Read only the supplied text. A composed British male assistant, clear natural English accent, smooth resonant delivery, measured conversational pace and understated dry wit. No theatrical impersonation, no exaggerated robotic effects.' } }] }],
      generationConfig: { responseModalities: ['AUDIO'], responseFormat: { audio: { mimeType: 'AUDIO_L16', sampleRate: 24000 } }, speechConfig: { voiceConfig: { voice: 'Charon' } } },
    }, true);
    if (!response.ok) return json({ error: await geminiError(response) }, response.status);
    const data = await response.json();
    const audio = data.candidates?.[0]?.content?.parts?.find((part: { inlineData?: { data?: string } }) => part.inlineData?.data)?.inlineData;
    if (!audio?.data) return json({ error: 'Gemini did not return spoken audio.' }, 422);
    return json({ audio: audio.data, mimeType: audio.mimeType || 'audio/l16', sampleRate: 24000 });
  } catch {
    return json({ error: 'Jarvis voice is temporarily unavailable.' }, 503);
  }
});