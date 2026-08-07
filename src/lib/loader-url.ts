// Branded loader URLs.
//
// The backend function URL keeps working forever (never change it — old
// scripts in the wild depend on it). This helper prefers whatever domain the
// site is currently served from, using a host redirect rule (public/_redirects)
// that forwards /s/<slug> to the get-paste function without changing headers
// or the client IP.

const SUPABASE_LOADER_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-paste`;

/** Direct backend URL — always valid, never changes. */
export const getRawLoaderUrl = (slug: string) => `${SUPABASE_LOADER_BASE}?slug=${slug}`;

/**
 * Hosts that serve the SPA for every path and cannot proxy /s/<slug> to the
 * backend. On those hosts a branded loadstring would download HTML instead of
 * Lua, so the executor gets `attempt to call a nil value`.
 */
const NON_PROXY_HOST_PATTERNS = [
  /\.lovable\.app$/i,
  /\.lovableproject\.com$/i,
  /^localhost$/i,
  /^127\.0\.0\.1$/,
];

export const hostSupportsBrandedLoader = () => {
  if (typeof window === "undefined") return false;
  return !NON_PROXY_HOST_PATTERNS.some((re) => re.test(window.location.hostname));
};

/**
 * Branded URL based on whatever domain the site is currently served from
 * (any host or custom domain). The host proxies /s/<slug> to the
 * get-paste function.
 */
export const getBrandedLoaderUrl = (slug: string) => {
  const origin =
    typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";
  return `${origin}/s/${slug}`;
};

/** URL that is guaranteed to return Lua. Branded /s pages are browser pages. */
export const getLoaderUrl = (slug: string) =>
  getRawLoaderUrl(slug);

/** Ready-to-paste, executor-compatible one-line loadstring. */
export const getLoadstring = (slug: string, key?: string | null) => {
  const transportUrl = getRawLoaderUrl(slug);
  const escapedKey = key?.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const line = `loadstring(game:HttpGet("${transportUrl}", true))()`;
  return escapedKey ? `_G.ScriptKey="${escapedKey}";${line}` : line;
};

