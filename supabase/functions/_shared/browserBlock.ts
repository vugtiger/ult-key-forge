// Redirects browser (HTML) visits away from raw backend endpoints to the
// public site's branded /blocked page. Non-browser callers (executors, API
// clients, Discord, cron) pass through untouched.
export function browserRedirectIfHtml(req: Request): Response | null {
  try {
    const accept = (req.headers.get("accept") || "").toLowerCase();
    const secFetchMode = (req.headers.get("sec-fetch-mode") || "").toLowerCase();
    const secFetchDest = (req.headers.get("sec-fetch-dest") || "").toLowerCase();
    // Only real top-level page navigations are redirected. App fetch/XHR calls
    // (mode: cors, dest: empty) and executor requests pass through.
    const looksNavigation =
      secFetchMode === "navigate" ||
      secFetchDest === "document" ||
      (req.method === "GET" && accept.startsWith("text/html"));
    if (!looksNavigation) return null;


    const site =
      Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/+$/, "") ||
      "https://ultluacodeprotectsyourluacode1.onrender.com";
    return Response.redirect(`${site}/blocked`, 302);
  } catch {
    return null;
  }
}
