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

// Many paths at once (a profile's portfolio, a chat's deliverables): storage path → public URL
export function videoUrls(paths: (string | null | undefined)[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of paths) {
    if (!p) continue;
    const u = videoUrl(p);
    if (u) out.set(p, u);
  }
  return out;
}
