const normalize = (value: string) => value.replace(/\/+$/, "");

/** Optional deployed website override. It can belong to any hosting provider. */
export const PUBLIC_LOADER_ORIGIN = normalize(
  (import.meta.env?.VITE_PUBLIC_LOADER_ORIGIN as string | undefined) || "",
);

/** Use the site that is actually serving the app, regardless of hosting provider. */
export const getLoaderOrigin = () => {
  if (PUBLIC_LOADER_ORIGIN) return PUBLIC_LOADER_ORIGIN;
  if (typeof window !== "undefined") return normalize(window.location.origin);
  return null;
};

/** Public website route used for both display and execution. */
export const getLoaderUrl = (slug: string) => {
  const origin = getLoaderOrigin();
  return origin ? `${origin}/s/${encodeURIComponent(slug)}` : `/s/${encodeURIComponent(slug)}`;
};

export const getBrandedLoaderUrl = getLoaderUrl;

/** Ready-to-paste loadstring snippet. */
export const getLoadstring = (slug: string, key?: string | null) => {
  const line = `loadstring(game:HttpGet("${getLoaderUrl(slug)}"))()`;
  return key ? `_G.ScriptKey = "${key}"\n${line}` : line;
};


