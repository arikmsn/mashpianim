// Public URLs for videos. The `videos` bucket is public (migration 024, owner 2026-11-18), so every video has one
// stable URL at /storage/v1/object/public/videos/<path> that the CDN caches globally — no per-request signing.
// A fresh signed token on every request meant a different URL each time, so the CDN never had the file and every
// play came from the origin (~2 MB/s, measured); a stable public URL is served from the edge. Paths are
// unguessable (portfolio/<auth-uid>/<timestamp>.<ext>). Pure string building, safe on the server and the client.

const BASE = (process.env.NEXT_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");

// One video's public URL. A row whose stored value is already a full URL (legacy) is returned as-is; a bare
// storage path becomes the public URL. null when there is nothing to show or the Supabase URL is not configured.
export function videoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!BASE) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${BASE}/storage/v1/object/public/videos/${encoded}`;
}

// Many paths at once (a profile's portfolio): storage path → public URL
export function videoUrls(paths: (string | null | undefined)[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of paths) {
    if (!p) continue;
    const u = videoUrl(p);
    if (u) out.set(p, u);
  }
  return out;
}

// --- Deliverables: the private bucket (migration 025) -------------------------------------------------------
// Connection deliverable videos (the paid UGC a creator uploads for a business) stay private (owner, 2026-11-18)
// — unlike the portfolio gallery, they must not be reachable by URL. They live in the `deliverables` bucket and
// are served only through short-lived signed URLs. The caller MUST have already checked the viewer is a party to
// the connection (or an admin); signing is done with the service role.
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any, any, any>;

export const DELIVERABLES_BUCKET = "deliverables";
const DELIVERABLE_TTL_SECONDS = 24 * 3600;

export async function signedDeliverableUrl(
  admin: Admin,
  path: string | null | undefined,
  opts: { download?: boolean; ttl?: number } = {}
): Promise<string | null> {
  if (!path) return null;
  const { data } = await admin.storage
    .from(DELIVERABLES_BUCKET)
    .createSignedUrl(path, opts.ttl ?? DELIVERABLE_TTL_SECONDS, opts.download ? { download: true } : undefined);
  return data?.signedUrl ?? null;
}

// A deliverable's poster thumbnail is private too (owner, 2026-11-19). It is stored either as a bare storage path
// (new uploads) or, for rows created before the move, a legacy public `thumbnails` URL — either way the object now
// lives in the `deliverables` bucket, so return the path to sign.
export function deliverableThumbPath(thumbnailUrl: string | null | undefined): string | null {
  if (!thumbnailUrl) return null;
  const m = thumbnailUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/(?:thumbnails|deliverables)\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : thumbnailUrl;
}

export async function signedDeliverableUrls(admin: Admin, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const clean = [...new Set(paths.filter((p): p is string => typeof p === "string" && p.length > 0))];
  if (clean.length === 0) return out;
  const { data } = await admin.storage.from(DELIVERABLES_BUCKET).createSignedUrls(clean, DELIVERABLE_TTL_SECONDS);
  for (const row of (data || []) as { path: string | null; signedUrl: string }[]) {
    if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  }
  return out;
}
