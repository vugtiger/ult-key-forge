import { supabase } from "@/integrations/supabase/client";

export const getDeviceId = () => {
  const key = "ult_device_id";
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(key, created);
    return created;
  } catch {
    return "unknown";
  }
};

export interface BanResult {
  banned?: boolean;
  reason?: string;
}

const TTL_MS = 60_000;

let cache: { key: string; at: number; result: BanResult } | null = null;
let inflight: { key: string; promise: Promise<BanResult> } | null = null;

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);

/**
 * Ban check with a short-lived cache and in-flight de-duplication so that
 * navigating around the app does not fire one edge-function call per route.
 */
export const checkBan = async (
  userId?: string,
  opts: { force?: boolean; timeoutMs?: number } = {}
): Promise<BanResult> => {
  const key = `${userId || "anon"}`;
  const now = Date.now();

  if (!opts.force && cache && cache.key === key && now - cache.at < TTL_MS) {
    return cache.result;
  }
  if (inflight && inflight.key === key) return inflight.promise;

  const promise = (async () => {
    try {
      const { data } = await withTimeout(
        supabase.functions.invoke("track-ip", {
          body: { action: "check_ban", user_id: userId, device_id: getDeviceId() },
        }) as unknown as Promise<{ data: BanResult | null }>,
        opts.timeoutMs ?? 6000
      );
      const result: BanResult = data || {};
      cache = { key, at: Date.now(), result };
      return result;
    } finally {
      inflight = null;
    }
  })();

  inflight = { key, promise };
  return promise;
};

export const clearBanCache = () => {
  cache = null;
};
