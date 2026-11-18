// Signed Storage URLs for videos, cached per path (owner, 2026-11-18: "some videos are really slow").
// The `videos` bucket is private, so every player gets a signed URL. Signing on every request minted a new
// token — a different URL for every business and every visit — and the CDN in front of Storage never had the
// file: each play came from the Paris origin at ~2 MB/s (measured: first fetch MISS, the same URL again HIT in
// 0.1 s). One URL per path per instance for most of a day lets the CDN serve the repeats. Server-only.
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any, any, any>;

export const SIGNED_TTL_SECONDS = 24 * 3600;
export const SIGNED_REFRESH_MS = 2 * 3600_000; // re-sign when less than this is left
const MAX_ENTRIES = 5000;

const cache = new Map<string, { url: string; expiresAt: number }>();

export function cachedVideoUrl(path: string, now: number = Date.now()): string | null {
  const hit = cache.get(path);
  return hit && hit.expiresAt - now > SIGNED_REFRESH_MS ? hit.url : null;
}

function remember(path: string, url: string, now: number) {
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(path, { url, expiresAt: now + SIGNED_TTL_SECONDS * 1000 });
}

export async function signedVideoUrl(admin: Admin, path: string): Promise<string | null> {
  const now = Date.now();
  const hit = cachedVideoUrl(path, now);
  if (hit) return hit;
  const { data } = await admin.storage.from("videos").createSignedUrl(path, SIGNED_TTL_SECONDS);
  if (!data?.signedUrl) return null;
  remember(path, data.signedUrl, now);
  return data.signedUrl;
}

// Many paths at once (a profile's portfolio, a chat's deliverables): one Storage call for the misses
export async function signedVideoUrls(admin: Admin, paths: string[]): Promise<Map<string, string>> {
  const now = Date.now();
  const out = new Map<string, string>();
  const missing: string[] = [];
  for (const p of new Set(paths)) {
    const hit = cachedVideoUrl(p, now);
    if (hit) out.set(p, hit);
    else missing.push(p);
  }
  if (missing.length > 0) {
    const { data } = await admin.storage.from("videos").createSignedUrls(missing, SIGNED_TTL_SECONDS);
    for (const row of (data || []) as { path: string | null; signedUrl: string }[]) {
      if (row.path && row.signedUrl) {
        out.set(row.path, row.signedUrl);
        remember(row.path, row.signedUrl, now);
      }
    }
  }
  return out;
}

// Tests only
export function _resetVideoLinkCache() {
  cache.clear();
}
