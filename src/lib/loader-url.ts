// Hosts used for local development or the editor preview do not run deployment
// rewrites. They use the delivery function directly so copied scripts still run.
const NON_DEPLOYED_HOST_PATTERNS = [
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

/** Optional deployed website override. It can belong to any hosting provider. */
export const PUBLIC_LOADER_ORIGIN = normalize(
  (import.meta.env?.VITE_PUBLIC_LOADER_ORIGIN as string | undefined) || "",
);

const isDeployedWebsite = (hostname: string) =>
  !NON_DEPLOYED_HOST_PATTERNS.some((pattern) => pattern.test(hostname));

/**
 * The public loader origin is the website currently serving the app. Preview
 * environments intentionally return null because they cannot apply deployment
 * forwarding rules.
 */
export const getLoaderOrigin = () => {
  if (typeof window !== "undefined" && isDeployedWebsite(window.location.hostname)) {
    return normalize(window.location.origin);
  }
  return PUBLIC_LOADER_ORIGIN || null;
};


/** Pretty link shown on the website (needs a host that forwards /s/<slug>). */
export const getBrandedLoaderUrl = (slug: string) => {
  const origin = getLoaderOrigin();
  if (origin) return `${origin}/s/${encodeURIComponent(slug)}`;
  return getDeliveryUrl(slug);
};

/** Always-working delivery endpoint, independent of the hosting provider. */
export const getDeliveryUrl = (slug: string) =>
  `${BACKEND_FUNCTION_ORIGIN}/functions/v1/get-paste/s/${encodeURIComponent(slug)}`;

/**
 * URL used inside loadstring. Uses the pretty host only when it is configured
 * to forward /s/<slug>; otherwise the executor would receive the website's
 * HTML page and loadstring would return nil.
 */
export const getLoaderUrl = (slug: string) => {
  const forwardingHost = normalize(
    (import.meta.env?.VITE_PUBLIC_LOADER_ORIGIN as string | undefined) || "",
  );
  return forwardingHost
    ? `${forwardingHost}/s/${encodeURIComponent(slug)}`
    : getDeliveryUrl(slug);
};

/** Ready-to-paste loadstring snippet. */
export const getLoadstring = (slug: string, key?: string | null) => {
  const line = `loadstring(game:HttpGet("${getLoaderUrl(slug)}"))()`;
  return key ? `_G.ScriptKey = "${key}"\n${line}` : line;
};


