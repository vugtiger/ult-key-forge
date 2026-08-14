// Host-agnostic app URLs: whatever domain the site is currently served from
// is the domain used for auth redirects and links.

const normalizeUrl = (value: string) => value.replace(/\/$/, "");

export const isRecoveryLinkPayload = (hash = window.location.hash) => {
  const params = new URLSearchParams(hash.replace(/^#/, ""));

  return (
    params.get("type") === "recovery" ||
    params.has("access_token") ||
    params.has("refresh_token") ||
    params.has("token_hash") ||
    params.has("error_code") ||
    params.has("error_description")
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
