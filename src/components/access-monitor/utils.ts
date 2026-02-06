import type { AccessLog } from "./types";

export const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

export const isActiveNow = (lastSeen: string) => {
  const date = new Date(lastSeen);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return diff < 60_000; // Active if seen in last minute
};

// Determine if the access was from a browser vs executor based on access_type
export const isBrowserRequest = (accessType: string) => {
  return accessType === 'browser';
};

export const accessLogKey = (log: Pick<AccessLog, "paste_id" | "ip_address" | "access_type" | "roblox_user_id">) => {
  return `${log.paste_id}|${log.access_type}|${log.ip_address}|${log.roblox_user_id ?? ""}`;
};

export const mergeAccessLog = (prev: AccessLog[], incoming: AccessLog) => {
  const incomingKey = accessLogKey(incoming);
  const idx = prev.findIndex((l) => accessLogKey(l) === incomingKey);

  if (idx === -1) return [incoming, ...prev];

  // Prefer the newest timestamp, but also keep any new fields
  const existing = prev[idx];
  const newer = new Date(incoming.last_seen_at).getTime() >= new Date(existing.last_seen_at).getTime();
  const merged = newer ? { ...existing, ...incoming } : { ...incoming, ...existing };

  const next = [...prev];
  next[idx] = merged;
  return next;
};

// Show only one row per Roblox user id (latest), to avoid the "2 IPs" confusion.
// Browser logs (no Roblox ID) remain grouped by IP.
export const groupForDisplay = (logs: AccessLog[]) => {
  const byGroup = new Map<string, AccessLog>();

  for (const log of logs) {
    const groupKey = log.roblox_user_id ? `roblox:${log.roblox_user_id}` : `ip:${log.ip_address}`;
    const existing = byGroup.get(groupKey);
    if (!existing) {
      byGroup.set(groupKey, log);
      continue;
    }
    const isNewer = new Date(log.last_seen_at).getTime() > new Date(existing.last_seen_at).getTime();
    if (isNewer) byGroup.set(groupKey, log);
  }

  return Array.from(byGroup.values()).sort(
    (a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime(),
  );
};
