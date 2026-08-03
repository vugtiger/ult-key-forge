// Branded loader URLs.
//
// The Supabase function URL keeps working forever (never change it — old
// scripts in the wild depend on it). This helper simply prefers the branded
// site domain when the app is served from a real (non-preview) host, using a
// Netlify proxy rule (public/_redirects) that forwards /s/<slug> to the
// get-paste function without changing headers or the client IP.

import { getAppBaseUrl } from "./site-url";

const SUPABASE_LOADER_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-paste`;

/** Direct Supabase URL — always valid, never changes. */
export const getRawLoaderUrl = (slug: string) => `${SUPABASE_LOADER_BASE}?slug=${slug}`;

/**
 * Branded URL. On preview hosts this resolves to the canonical Netlify site
 * (which proxies /s/<slug> to the function), so copied loadstrings always show
 * the branded domain instead of the raw backend URL.
 */
export const getLoaderUrl = (slug: string) => `${getAppBaseUrl()}/s/${slug}`;

/** Ready-to-paste loadstring snippet. */
export const getLoadstring = (slug: string, key?: string | null) => {
  const line = `loadstring(game:HttpGet("${getLoaderUrl(slug)}"))()`;
  return key ? `_G.ScriptKey = "${key}"\n${line}` : line;
};
