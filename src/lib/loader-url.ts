import { getAppBaseUrl } from "@/lib/site-url";

/**
 * Public loader URL that users paste into their executor.
 * Points at the app's own domain (`/s/:slug`) which Netlify rewrites to the
 * backend `get-paste` endpoint. Never exposes the raw backend URL.
 */
export const buildLoaderUrl = (slug: string) => {
  return `${getAppBaseUrl()}/s/${slug}`;
};

export const buildLoadstring = (slug: string) => {
  return `loadstring(game:HttpGet("${buildLoaderUrl(slug)}"))()`;
};
