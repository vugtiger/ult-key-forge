// Redirects browser (HTML) visits away from raw backend endpoints to the
// public site's branded /blocked page. Non-browser callers (executors, API
// clients, Discord, cron) pass through untouched.
export function browserRedirectIfHtml(req: Request): Response | null {
  try {
    const ua = (req.headers.get("user-agent") || "").toLowerCase();
    const accept = (req.headers.get("accept") || "").toLowerCase();
    const secFetch = (req.headers.get("sec-fetch-mode") || "").toLowerCase();
    const looksBrowser =
      accept.includes("text/html") ||
      secFetch === "navigate" ||
      (ua.includes("mozilla") && !ua.includes("roblox") && !ua.includes("httpget"));
    if (!looksBrowser) return null;

    const site =
      Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/+$/, "") ||
      "https://ultluacodeprotectsyourluacode.onrender.com";
    return Response.redirect(`${site}/blocked`, 302);
  } catch {
    return null;
  }
}
