const normalize = (value: string) => value.replace(/\/+$/, "");

/** Optional deployed website override. It can belong to any hosting provider. */
export const PUBLIC_LOADER_ORIGIN = normalize(
  (import.meta.env?.VITE_PUBLIC_LOADER_ORIGIN as string | undefined) || "",
);

const DELIVERY_BASE = `${normalize(
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) || "",
)}/functions/v1/get-paste`;

/** Whichever site currently serves the app, regardless of hosting provider. */
export const getSiteOrigin = () => {
  if (PUBLIC_LOADER_ORIGIN) return PUBLIC_LOADER_ORIGIN;
  if (typeof window !== "undefined") return normalize(window.location.origin);
  return "";
};


/** Executable delivery link. Uses the current website origin (the host forwards /s/* to the script service). */
export const getLoaderUrl = (slug: string) => {
  const encoded = encodeURIComponent(slug);
  const origin = getSiteOrigin();
  return origin ? `${origin}/s/${encoded}` : `${DELIVERY_BASE}/s/${encoded}`;
};


export const getLoaderOrigin = getSiteOrigin;
export const getBrandedLoaderUrl = getLoaderUrl;

/** Ready-to-paste loadstring snippet. */
export const getLoadstring = (slug: string, key?: string | null) => {
  const line = `loadstring(game:HttpGet("${getLoaderUrl(slug)}"))()`;
  return key ? `_G.ScriptKey = "${key}"\n${line}` : line;
};
