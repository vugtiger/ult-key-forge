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

/** URL that is guaranteed to return Lua on the current host. */
export const getLoaderUrl = (slug: string) =>
  hostSupportsBrandedLoader() ? getBrandedLoaderUrl(slug) : getRawLoaderUrl(slug);

/** Ready-to-paste loadstring snippet. */
export const getLoadstring = (slug: string, key?: string | null) => {
  const loaderUrl = getLoaderUrl(slug);
  let line: string;

  if (hostSupportsBrandedLoader()) {
    line = `loadstring(game:HttpGet("${loaderUrl}"))()`;
  } else {
    // SPA-only hosts cannot reverse-proxy /s/<slug>; fetching that path from an
    // executor returns index.html. Keep the branded page as the visible link,
    // but assemble the stable backend transport at runtime so the copied loader
    // remains executable without exposing the backend URL as readable text.
    const transportUrl = getRawLoaderUrl(slug);
    const encodedTransport = Array.from(new TextEncoder().encode(transportUrl)).join(",");
    line = `local _ULT_PAGE="${getBrandedLoaderUrl(slug)}"\nlocal _ULT_URL=string.char(${encodedTransport})\nlocal _ULT_BODY=game:HttpGet(_ULT_URL)\nlocal _ULT_RUN,_ULT_ERR=loadstring(_ULT_BODY)\nif type(_ULT_RUN)~="function" then error("ULT loader unavailable: "..tostring(_ULT_ERR)) end\n_ULT_RUN()`;
  }
  return key ? `_G.ScriptKey = "${key}"\n${line}` : line;
};

