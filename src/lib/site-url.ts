// Host-agnostic app URLs: whatever domain the site is currently served from
// is the domain used for auth redirects and links.

const normalizeUrl = (value: string) => value.replace(/\/$/, "");

export const isRecoveryLinkPayload = (hash = window.location.hash) => {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const has = (k: string) => params.has(k) || query.has(k);

  return (
    params.get("type") === "recovery" ||
    query.get("type") === "recovery" ||
    has("code") ||
    has("access_token") ||
    has("refresh_token") ||
    has("token_hash") ||
    has("error_code") ||
    has("error_description")
  );
};

export const getAppBaseUrl = () => {
  if (typeof window === "undefined") return "";
  return normalizeUrl(window.location.origin);
};

export const buildAppUrl = (path = "/") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAppBaseUrl()}${normalizedPath}`;
};
