// Branded loader URLs.
//
// The Supabase function URL keeps working forever (never change it — old
// scripts in the wild depend on it). This helper simply prefers the branded
// site domain when the app is served from a real (non-preview) host, using a
// Netlify proxy rule (public/_redirects) that forwards /s/<slug> to the
// get-paste function without changing headers or the client IP.

const SUPABASE_LOADER_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-paste`;

const PREVIEW_HOST_PATTERNS = [
  "localhost",
  "127.0.0.1",
  ".lovable.app",
  ".lovableproject.com",
  ".lovable.dev",
];

const isPreviewHost = () => {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return PREVIEW_HOST_PATTERNS.some((p) => host === p || host.endsWith(p));
};

/** Direct Supabase URL — always valid, never changes. */
export const getRawLoaderUrl = (slug: string) => `${SUPABASE_LOADER_BASE}?slug=${slug}`;

/** Branded URL when available, otherwise the raw Supabase URL. */
export const getLoaderUrl = (slug: string) => {
  if (isPreviewHost()) return getRawLoaderUrl(slug);
  return `${window.location.origin}/s/${slug}`;
};

/** Ready-to-paste loadstring snippet. */
export const getLoadstring = (slug: string, key?: string | null) => {
  const line = `loadstring(game:HttpGet("${getLoaderUrl(slug)}"))()`;
  return key ? `_G.ScriptKey = "${key}"\n${line}` : line;
};
