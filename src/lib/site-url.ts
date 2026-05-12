const CANONICAL_APP_URL = "https://ultluaprotectsyourluacode.netlify.app";

const PREVIEW_HOST_PATTERNS = ["localhost", "127.0.0.1", ".lovable.app", ".lovableproject.com", ".lovable.dev"];

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
  if (typeof window === "undefined") {
    return CANONICAL_APP_URL;
  }

  const currentOrigin = normalizeUrl(window.location.origin);
  const currentHost = window.location.hostname;
  const isPreviewHost = PREVIEW_HOST_PATTERNS.some(
    (pattern) => currentHost === pattern || currentHost.endsWith(pattern),
  );

  return isPreviewHost ? CANONICAL_APP_URL : currentOrigin;
};

export const buildAppUrl = (path = "/") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizeUrl(getAppBaseUrl())}${normalizedPath}`;
};