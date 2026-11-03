"use client";

// Stale-while-revalidate cache for GET API calls. Pages render the last known
// response instantly on revisit and swap in fresh data when it arrives.

const memory = new Map<string, unknown>();
const PREFIX = "mashpian:cache:";

// One network request per URL at a time (several components asking for /api/profile on the same screen
// share a single fetch), and a short freshness window so a screen change doesn't refetch what arrived a
// moment ago.
const inflight = new Map<string, Promise<unknown>>();
const fetchedAt = new Map<string, number>();
const DEFAULT_FRESH_MS = 2000;

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
  for (const key of Array.from(fetchedAt.keys())) {
    if (!prefix || key.startsWith(prefix)) fetchedAt.delete(key);
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

// Which signed-in user the cached responses belong to. When the session's user changes (someone else logs
// in, logout, expired session) the cache is dropped so one person's data never renders for another (QA-01).
export const CACHE_OWNER_KEY = "mashpian:cache-owner";

export function shouldResetCache(previousOwner: string | null, nextOwner: string | null): boolean {
  return previousOwner !== nextOwner;
}

export function syncCacheOwner(userId: string | null) {
  let previous: string | null = null;
  try {
    previous = sessionStorage.getItem(CACHE_OWNER_KEY);
  } catch {
    // storage unavailable
  }
  if (!shouldResetCache(previous, userId)) return;
  clearCache();
  try {
    if (userId) sessionStorage.setItem(CACHE_OWNER_KEY, userId);
    else sessionStorage.removeItem(CACHE_OWNER_KEY);
  } catch {
    // ignore
  }
}

// Always goes to the network (deduplicated while a request for the same URL is in flight).
export async function fetchJson<T>(url: string): Promise<T | null> {
  const running = inflight.get(url);
  if (running) return running as Promise<T | null>;

  const request = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = (await res.json()) as T;
      writeCache(url, data);
      fetchedAt.set(url, Date.now());
      return data;
    } catch {
      return null;
    } finally {
      inflight.delete(url);
    }
  })();
  inflight.set(url, request);
  return request;
}

// Calls `apply` with cached data right away (if any), then again with fresh data — unless the same URL was
// fetched within `freshMs` (default 2 s), in which case the cached copy is already current.
export async function swrFetch<T>(
  url: string,
  apply: (data: T, fromCache: boolean) => void,
  freshMs: number = DEFAULT_FRESH_MS
): Promise<T | null> {
  const cached = readCache<T>(url);
  if (cached !== undefined) {
    apply(cached, true);
    const last = fetchedAt.get(url);
    if (last && Date.now() - last < freshMs) return cached;
  }
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
