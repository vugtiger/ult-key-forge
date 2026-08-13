// Branded loader URLs.
//
// The backend function URL keeps working forever (never change it — old
// scripts in the wild depend on it). Hosts that support rewrite rules
// (Netlify via public/_redirects, Vercel via vercel.json) forward
// /s/<slug> straight to the get-paste function without touching headers or
// the client IP, so a plain `loadstring(game:HttpGet("https://yourdomain/s/x"))()`
// works and never exposes the backend URL.

const SUPABASE_LOADER_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-paste`;

/** Direct backend URL — always valid, never changes. */
export const getRawLoaderUrl = (slug: string) => `${SUPABASE_LOADER_BASE}?slug=${slug}`;

/**
 * Hosts that serve the SPA for every path and cannot proxy /s/<slug> to the
 * backend. On those hosts a branded loadstring would download HTML instead of
 * Lua, so we fall back to the backend URL there.
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

/** URL used inside the loadstring. Branded when the host can proxy it. */
export const getLoaderUrl = (slug: string) =>
  hostSupportsBrandedLoader() ? getBrandedLoaderUrl(slug) : getRawLoaderUrl(slug);

/** Ready-to-paste loadstring snippet — a single, clean line. */
export const getLoadstring = (slug: string, key?: string | null) => {
  const line = `loadstring(game:HttpGet("${getLoaderUrl(slug)}"))()`;
  return key ? `_G.ScriptKey = "${key}"\n${line}` : line;
};
