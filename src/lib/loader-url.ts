// Branded loader URLs.
//
// The backend function URL keeps working forever (never change it — old
// scripts in the wild depend on it). This helper prefers whatever domain the
// site is currently served from, using a host redirect rule (public/_redirects)
// that forwards /s/<slug> to the get-paste function without changing headers
// or the client IP.

// This is the public loader address. The host proxies /s/<slug> to the private
// delivery function, so copied scripts never expose the backend function URL.
export const PUBLIC_LOADER_ORIGIN = "https://ultluaprotectsyourluacode.netlify.app";

/**
 * Branded URL based on whatever domain the site is currently served from
 * (any host or custom domain). The host proxies /s/<slug> to the
 * get-paste function.
 */
export const getBrandedLoaderUrl = (slug: string) => {
  return `${PUBLIC_LOADER_ORIGIN}/s/${encodeURIComponent(slug)}`;
};

/**
 * URL used inside loadstring. Prefers the branded domain (`/s/<slug>`) which
 * the host rewrites straight to the backend function, so executors receive Lua
 * and never see the backend URL. Falls back to the backend URL on hosts that
 * cannot proxy (local dev / lovable preview).
 */
export const getLoaderUrl = (slug: string) => getBrandedLoaderUrl(slug);

/** Ready-to-paste loadstring snippet. */
export const getLoadstring = (slug: string, key?: string | null) => {
  const line = `loadstring(game:HttpGet("${getLoaderUrl(slug)}"))()`;
  return key ? `_G.ScriptKey = "${key}"\n${line}` : line;
};


