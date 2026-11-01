export async function geminiError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  const message = body?.error?.message;
  if (typeof message === 'string' && message.trim()) {
    return message.replace(/AIza[\w-]+/g, '[redacted]').slice(0, 700);
  }
  return `Google Gemini request failed (${response.status}).`;
}