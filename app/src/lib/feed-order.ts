// The order of the creator's deck (pure, unit-tested). The owner wants the products shuffled (2026-11-09),
// but a shuffle that changes under the creator's thumb while she browses would be maddening — so the order
// is random per visit: a seed is drawn once per browser session and every product gets a stable position
// from it. New sessions, new order.

export const FEED_SEED_KEY = "mashpian:feed-seed";

// FNV-1a over seed + id → a 32-bit position; the same (seed, id) always lands in the same place
export function orderKey(id: string, seed: string): number {
  let h = 0x811c9dc5;
  const s = `${seed}|${id}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function shuffledBySeed<T extends { id: string }>(items: T[], seed: string): T[] {
  return [...items].sort((a, b) => orderKey(a.id, seed) - orderKey(b.id, seed) || a.id.localeCompare(b.id));
}

export function newFeedSeed(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// The session's seed (created on first use); a fixed value when storage is unavailable (SSR, private mode)
export function feedSeed(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const existing = window.sessionStorage.getItem(FEED_SEED_KEY);
    if (existing) return existing;
    const seed = newFeedSeed();
    window.sessionStorage.setItem(FEED_SEED_KEY, seed);
    return seed;
  } catch {
    return "nostorage";
  }
}
