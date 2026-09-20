const normalize = (value: string) => value.replace(/\/+$/, "");

const DELIVERY_ORIGIN = normalize(
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) || "",
);

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
  const publicUrl = getLoaderUrl(slug);
  const deliveryUrl = `${DELIVERY_ORIGIN}/functions/v1/get-paste/s/${encodeURIComponent(slug)}`;
  const encodedDeliveryUrl = Array.from(deliveryUrl, (character) => character.charCodeAt(0)).join(",");
  const line = `local s=game:HttpGet("${publicUrl}");local f=loadstring(s);if not f then f=loadstring(game:HttpGet(string.char(${encodedDeliveryUrl})))end;if not f then error("ULT loader unavailable")end;f()`;
  return key ? `_G.ScriptKey = "${key}"\n${line}` : line;
};


