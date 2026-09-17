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
  /^id-preview--/i,
  /\.lovableproject\.com$/i,
  /\.sandbox\.lovable\.dev$/i,
];

const normalize = (value: string) => value.replace(/\/+$/, "");

/** Configured fallback, used only when the current host can't serve loaders. */
export const PUBLIC_LOADER_ORIGIN = normalize(
  (import.meta.env?.VITE_PUBLIC_LOADER_ORIGIN as string | undefined) ||
    "https://ultluacodeprotectsyourcode.lovable.app",
);


/**
 * The origin loaders should point at: whatever domain the site is currently
 * served from (Netlify, Vercel, a custom domain, anything), falling back to the
 * configured public origin on local/preview hosts.
 */
export const getLoaderOrigin = () => {
  if (typeof window === "undefined") return PUBLIC_LOADER_ORIGIN;
  const { hostname, origin } = window.location;
  if (NON_PUBLIC_HOST_PATTERNS.some((p) => p.test(hostname))) {
    return PUBLIC_LOADER_ORIGIN;
  }
  return normalize(origin);
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


