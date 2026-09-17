// Branded loader URLs.
//
// The backend function URL keeps working forever (never change it — old
// scripts in the wild depend on it). This helper prefers whatever domain the
// site is currently served from, using a host redirect rule (public/_redirects)
// that forwards /s/<slug> to the get-paste function without changing headers
// or the client IP.

// Hosts that cannot serve the /s/<slug> proxy rule (local dev + in-editor
// preview). On those we fall back to the configured public site address.
const NON_PUBLIC_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.0\.0\.1$/,
  /^0\.0\.0\.0$/,
  /\.lovable\.app$/i,
  /\.lovableproject\.com$/i,
  /\.sandbox\.lovable\.dev$/i,
];

const normalize = (value: string) => value.replace(/\/+$/, "");

/** Direct backend address — always works, used when no proxy host is available. */
const BACKEND_FUNCTION_ORIGIN = normalize(
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) || "",
);

/** Optional override for the public site address that serves /s/<slug>. */
export const PUBLIC_LOADER_ORIGIN = normalize(
  (import.meta.env?.VITE_PUBLIC_LOADER_ORIGIN as string | undefined) || "",
);

const canProxy = (hostname: string) =>
  !NON_PUBLIC_HOST_PATTERNS.some((p) => p.test(hostname));

/**
 * The origin loaders should point at: whatever domain the site is currently
 * served from (Netlify, Vercel, a custom domain, anything). Hosts that cannot
 * forward /s/<slug> (local dev, in-editor preview, Lovable hosting) use the
 * configured public site address, or the backend address as a last resort so
 * the copied loadstring always works.
 */
export const getLoaderOrigin = () => {
  if (typeof window !== "undefined" && canProxy(window.location.hostname)) {
    return normalize(window.location.origin);
  }
  return PUBLIC_LOADER_ORIGIN || null;
};


/**
 * Branded URL based on whatever domain the site is currently served from
 * (any host or custom domain). The host proxies /s/<slug> to the
 * get-paste function.
 */
export const getBrandedLoaderUrl = (slug: string) => {
  return `${getLoaderOrigin()}/s/${encodeURIComponent(slug)}`;
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


