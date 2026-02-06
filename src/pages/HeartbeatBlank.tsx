import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export default function HeartbeatBlank() {
  const [params] = useSearchParams();
  const slug = params.get("slug") ?? "";
  const id = params.get("id") ?? "";

  const baseUrl = useMemo(() => {
    if (!slug || !id) return null;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/functions/v1/paste-heartbeat?id=${encodeURIComponent(id)}&slug=${encodeURIComponent(slug)}`;
  }, [id, slug]);

  useEffect(() => {
    if (!baseUrl) return;

    const ping = () => {
      fetch(`${baseUrl}&t=${Date.now()}`, {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        keepalive: true,
      }).catch(() => {
        // ignore
      });
    };

    ping();
    const interval = window.setInterval(ping, 25_000);

    const onVis = () => {
      if (!document.hidden) ping();
    };
    document.addEventListener("visibilitychange", onVis);

    const onPageHide = () => {
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(`${baseUrl}&t=${Date.now()}`, "");
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [baseUrl]);

  // Intentionally render nothing (blank page)
  return null;
}
