const normalize = (value: string) => value.replace(/\/+$/, "");

/** Optional deployed website override. It can belong to any hosting provider. */
export const PUBLIC_LOADER_ORIGIN = normalize(
  (import.meta.env?.VITE_PUBLIC_LOADER_ORIGIN as string | undefined) || "",
);

const DELIVERY_BASE = `${normalize(
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) || "",
)}/functions/v1/get-paste`;

const STORAGE_KEY = "ult_site_forwards_loader";

/** Whichever site currently serves the app, regardless of hosting provider. */
export const getSiteOrigin = () => {
  if (PUBLIC_LOADER_ORIGIN) return PUBLIC_LOADER_ORIGIN;
  if (typeof window !== "undefined") return normalize(window.location.origin);
  return "";
};

/** True only when this host is proven to forward /s/:slug to the delivery service. */
const siteForwards = () => {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(`${STORAGE_KEY}:${window.location.origin}`) === "yes";
  } catch {
    return false;
  }
};

/**
 * Checks once per session whether the current website forwards /s/:slug.
 * If it does, links stay on the website; if it does not, links use the
 * delivery address directly so executing always works.
 */
export const probeLoaderHost = async () => {
  if (typeof window === "undefined") return;
  const key = `${STORAGE_KEY}:${window.location.origin}`;
  try {
    const res = await fetch(`/s/__ult_host_probe__?v=${Date.now()}`, { cache: "no-store" });
    const body = await res.text();
    const isHtml = /<!doctype html|<html/i.test(body.slice(0, 400));
    localStorage.setItem(key, !isHtml && res.status !== 404 ? "yes" : "no");
  } catch {
    try { localStorage.setItem(key, "no"); } catch { /* ignore */ }
  }
};

/** Public link used for both display and execution. */
export const getLoaderUrl = (slug: string) => {
  const encoded = encodeURIComponent(slug);
  const origin = getSiteOrigin();
  if (origin && siteForwards()) return `${origin}/s/${encoded}`;
  return `${DELIVERY_BASE}/s/${encoded}`;
};

export const getLoaderOrigin = getSiteOrigin;
export const getBrandedLoaderUrl = getLoaderUrl;

/** Ready-to-paste loadstring snippet. */
export const getLoadstring = (slug: string, key?: string | null) => {
  const line = `loadstring(game:HttpGet("${getLoaderUrl(slug)}"))()`;
  return key ? `_G.ScriptKey = "${key}"\n${line}` : line;
};
