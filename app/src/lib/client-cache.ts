"use client";

// Stale-while-revalidate cache for GET API calls. Pages render the last known
// response instantly on revisit and swap in fresh data when it arrives.

const memory = new Map<string, unknown>();
const PREFIX = "mashpian:cache:";

export function readCache<T>(key: string): T | undefined {
  if (memory.has(key)) return memory.get(key) as T;
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (raw) {
      const parsed = JSON.parse(raw) as T;
      memory.set(key, parsed);
      return parsed;
    }
  } catch {
    // storage unavailable
  }
  return undefined;
}

export function writeCache(key: string, data: unknown) {
  memory.set(key, data);
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {
    // storage full / unavailable
  }
}

export function clearCache(prefix?: string) {
  for (const key of Array.from(memory.keys())) {
    if (!prefix || key.startsWith(prefix)) memory.delete(key);
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(PREFIX) && (!prefix || k.slice(PREFIX.length).startsWith(prefix))) {
        sessionStorage.removeItem(k);
      }
    }
  } catch {
    // ignore
  }
}

export async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    writeCache(url, data);
    return data;
  } catch {
    return null;
  }
}

// Calls `apply` with cached data right away (if any), then again with fresh data.
export async function swrFetch<T>(url: string, apply: (data: T, fromCache: boolean) => void): Promise<T | null> {
  const cached = readCache<T>(url);
  if (cached !== undefined) apply(cached, true);
  const fresh = await fetchJson<T>(url);
  if (fresh !== null) apply(fresh, false);
  return fresh;
}

// Lightweight cross-component signals (e.g. "unread count changed").
export const UNREAD_EVENT = "mashpian:unread-changed";

export function emitUnreadChanged(delta?: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(UNREAD_EVENT, { detail: { delta } }));
}
